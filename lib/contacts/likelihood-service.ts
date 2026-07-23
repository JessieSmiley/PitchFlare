import { db } from "@/lib/db";
import { anthropic, MODELS } from "@/lib/ai/anthropic";
import { logAIUsage } from "@/lib/ai/log";
import {
  buildRationale,
  computeLikelihood,
  EXCLUSIVES_FIELD_KEY,
  PR_DRIVEN_FIELD_KEY,
  type FlagSignal,
  type LikelihoodInputs,
  type LikelihoodResult,
  type RecentWorkItem,
} from "./likelihood";

export { EXCLUSIVES_FIELD_KEY, PR_DRIVEN_FIELD_KEY };

/**
 * DB + AI wrappers around the pure `computeLikelihood` engine.
 *
 * Two entry points, on purpose:
 *   - `scoreContactsLikelihood` — batched, in-memory, NO AI and NO writes. For
 *     the Targets table, where computing 200 rows must be cheap. Rationales are
 *     the deterministic template.
 *   - `getContactLikelihood` — single contact, may spend a Haiku call for a
 *     nicer rationale, and caches the result in `CoverageLikelihood` so we
 *     don't regenerate the sentence on every drawer open.
 */

/**
 * Assemble the topic terms a campaign contributes to the "covered topic in the
 * last 30 days" signal — the campaign title/objective plus its primary and
 * selected angles. Mirrors how the Targets page builds match terms, kept here
 * so the page and the drawer's AI-refine action stay in sync.
 */
export async function resolveCampaignTopicTerms(
  brandId: string,
  campaignId: string,
): Promise<string[]> {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, brandId },
    include: {
      primaryAngle: { select: { title: true, hook: true, audienceFit: true } },
      angles: {
        where: { selected: true },
        select: { title: true, hook: true, audienceFit: true },
      },
    },
  });
  if (!campaign) return [];
  return [
    campaign.title,
    campaign.objective,
    campaign.primaryAngle?.title,
    campaign.primaryAngle?.hook,
    campaign.primaryAngle?.audienceFit,
    ...campaign.angles.flatMap((a) => [a.title, a.hook, a.audienceFit]),
    ...(campaign.toneTags ?? []),
  ].filter((s): s is string => Boolean(s && s.length));
}

// A cached likelihood older than this is recomputed on the next drawer open.
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

type ContactFieldRow = { key: string; value: string; source: string };

/**
 * Turn a manual/inferred ContactField into a FlagSignal. USER_ADDED "yes"
 * counts at full strength; an AI_INFERRED "yes" is discounted to 0.5 (and
 * badged as inferred). Absence → null (signal unavailable).
 */
export function flagFromFields(fields: ContactFieldRow[], key: string): FlagSignal {
  const row = fields.find((f) => f.key === key);
  if (!row) return { value: null, inferred: false };
  const inferred = row.source === "AI_INFERRED";
  const v = row.value.trim().toLowerCase();
  const isYes = ["yes", "true", "likely", "1", "high"].includes(v);
  const isNo = ["no", "false", "unlikely", "0", "low"].includes(v);
  if (!isYes && !isNo) return { value: null, inferred };
  return { value: isYes ? (inferred ? 0.5 : 1.0) : 0, inferred };
}

/** Per-contact behavioral data the bulk scorer needs, minus the shared bits. */
export type ContactBundle = {
  contactId: string;
  recentWork: RecentWorkItem[];
  fields: ContactFieldRow[];
};

type BulkContext = {
  topicTerms: string[];
  competitorNames: string[];
  categoryTerms?: string[];
  /** contactId → { replies, pitches, lastReplyAt } */
  interactions: Map<
    string,
    { replyCount: number; pitchedCount: number; lastReplyAt: Date | null }
  >;
  now?: Date;
};

function buildInputs(bundle: ContactBundle, ctx: BulkContext): LikelihoodInputs {
  const inter = ctx.interactions.get(bundle.contactId);
  return {
    now: ctx.now,
    replyCount: inter?.replyCount ?? 0,
    lastReplyAt: inter?.lastReplyAt ?? null,
    pitchedCount: inter?.pitchedCount ?? 0,
    recentWork: bundle.recentWork,
    topicTerms: ctx.topicTerms,
    competitorNames: ctx.competitorNames,
    categoryTerms: ctx.categoryTerms,
    prefersExclusives: flagFromFields(bundle.fields, EXCLUSIVES_FIELD_KEY),
    prDrivenAverse: flagFromFields(bundle.fields, PR_DRIVEN_FIELD_KEY),
  };
}

export type ScoredLikelihood = LikelihoodResult & { rationale: string };

/**
 * Load the brand-scoped shared context (competitors + interaction ledger) for
 * a set of contacts in two queries, then score them all in memory. Returns a
 * Map keyed by contactId. No AI, no persistence — safe to call on every render
 * of the Targets table.
 */
export async function scoreContactsLikelihood(
  brandId: string,
  contacts: ContactBundle[],
  opts: { topicTerms?: string[]; categoryTerms?: string[] } = {},
): Promise<Map<string, ScoredLikelihood>> {
  const ids = contacts.map((c) => c.contactId);
  if (ids.length === 0) return new Map();

  const [competitors, interactionGroups] = await Promise.all([
    db.competitor.findMany({ where: { brandId }, select: { name: true } }),
    db.contactInteraction.groupBy({
      by: ["contactId", "kind"],
      where: {
        brandId,
        contactId: { in: ids },
        kind: { in: ["PITCH_SENT", "REPLY_RECEIVED"] },
      },
      _count: { _all: true },
      _max: { occurredAt: true },
    }),
  ]);

  const interactions = new Map<
    string,
    { replyCount: number; pitchedCount: number; lastReplyAt: Date | null }
  >();
  for (const g of interactionGroups) {
    const cur = interactions.get(g.contactId) ?? {
      replyCount: 0,
      pitchedCount: 0,
      lastReplyAt: null,
    };
    if (g.kind === "PITCH_SENT") cur.pitchedCount += g._count._all;
    if (g.kind === "REPLY_RECEIVED") {
      cur.replyCount += g._count._all;
      cur.lastReplyAt = g._max.occurredAt ?? cur.lastReplyAt;
    }
    interactions.set(g.contactId, cur);
  }

  const ctx: BulkContext = {
    topicTerms: opts.topicTerms ?? [],
    competitorNames: competitors.map((c) => c.name),
    categoryTerms: opts.categoryTerms,
    interactions,
  };

  const out = new Map<string, ScoredLikelihood>();
  for (const bundle of contacts) {
    const result = computeLikelihood(buildInputs(bundle, ctx));
    out.set(bundle.contactId, { ...result, rationale: buildRationale(result) });
  }
  return out;
}

/**
 * Score a single contact and cache the result (with an optional Haiku-written
 * rationale) in `CoverageLikelihood`. Used by the profile drawer. Falls back to
 * the deterministic rationale on any AI issue, and to a fresh compute if the
 * cache is missing or stale.
 */
export async function getContactLikelihood(
  brandId: string,
  contactId: string,
  opts: {
    campaignId?: string | null;
    topicTerms?: string[];
    categoryTerms?: string[];
    accountId?: string;
    useAI?: boolean;
  } = {},
): Promise<ScoredLikelihood> {
  const campaignId = opts.campaignId ?? null;

  // Serve a fresh cache row as-is (avoids recomputing + re-calling Haiku).
  const cached = await db.coverageLikelihood.findFirst({
    where: { brandId, contactId, campaignId },
  });
  if (cached && Date.now() - cached.computedAt.getTime() < CACHE_TTL_MS) {
    return {
      score: cached.score,
      confidence: cached.confidence,
      breakdown: cached.breakdown as unknown as LikelihoodResult["breakdown"],
      rationale: cached.rationale ?? "",
    };
  }

  const [contact, competitors] = await Promise.all([
    db.contact.findUnique({
      where: { id: contactId },
      select: {
        recentWork: {
          select: { title: true, excerpt: true, publishedAt: true },
          orderBy: { publishedAt: "desc" },
          take: 30,
        },
        fields: { select: { key: true, value: true, source: true } },
      },
    }),
    db.competitor.findMany({ where: { brandId }, select: { name: true } }),
  ]);
  if (!contact) {
    const empty = computeLikelihood({
      replyCount: 0,
      lastReplyAt: null,
      pitchedCount: 0,
      recentWork: [],
      topicTerms: [],
      competitorNames: [],
      prefersExclusives: { value: null, inferred: false },
      prDrivenAverse: { value: null, inferred: false },
    });
    return { ...empty, rationale: buildRationale(empty) };
  }

  const interactionGroups = await db.contactInteraction.groupBy({
    by: ["kind"],
    where: {
      brandId,
      contactId,
      kind: { in: ["PITCH_SENT", "REPLY_RECEIVED"] },
    },
    _count: { _all: true },
    _max: { occurredAt: true },
  });
  let replyCount = 0;
  let pitchedCount = 0;
  let lastReplyAt: Date | null = null;
  for (const g of interactionGroups) {
    if (g.kind === "PITCH_SENT") pitchedCount = g._count._all;
    if (g.kind === "REPLY_RECEIVED") {
      replyCount = g._count._all;
      lastReplyAt = g._max.occurredAt ?? null;
    }
  }

  const inputs: LikelihoodInputs = {
    replyCount,
    lastReplyAt,
    pitchedCount,
    recentWork: contact.recentWork,
    topicTerms: opts.topicTerms ?? [],
    competitorNames: competitors.map((c) => c.name),
    categoryTerms: opts.categoryTerms,
    prefersExclusives: flagFromFields(contact.fields, EXCLUSIVES_FIELD_KEY),
    prDrivenAverse: flagFromFields(contact.fields, PR_DRIVEN_FIELD_KEY),
  };
  const result = computeLikelihood(inputs);

  let rationale = buildRationale(result);
  let modelUsed: string | null = null;
  if (opts.useAI) {
    const ai = await generateLikelihoodRationale(result, opts.accountId, brandId);
    if (ai) {
      rationale = ai;
      modelUsed = MODELS.haiku;
    }
  }

  // Upsert-by-hand: the compound unique includes a nullable campaignId, which
  // Prisma's upsert can't target when null, so we branch on the cache lookup.
  const data = {
    score: result.score,
    confidence: result.confidence,
    breakdown: result.breakdown as unknown as object,
    rationale,
    modelUsed,
    computedAt: new Date(),
  };
  try {
    if (cached) {
      await db.coverageLikelihood.update({ where: { id: cached.id }, data });
    } else {
      await db.coverageLikelihood.create({
        data: { brandId, contactId, campaignId, ...data },
      });
    }
  } catch (err) {
    // Caching is best-effort; a write race must never break the drawer.
    console.error("coverageLikelihood cache write failed:", err);
  }

  return { ...result, rationale };
}

/**
 * Drop cached likelihoods for a contact so the next read recomputes. Call this
 * when new behavioral data lands (a pitch sent, a reply, coverage authored).
 */
export async function invalidateLikelihood(
  brandId: string,
  contactId: string,
): Promise<void> {
  try {
    await db.coverageLikelihood.deleteMany({ where: { brandId, contactId } });
  } catch (err) {
    console.error("invalidateLikelihood failed:", err);
  }
}

/**
 * Haiku-written one-liner from the signal breakdown. Constrained to the facts
 * we pass in — it can only rephrase the detail strings, never invent signals.
 * Returns null on any failure so the caller keeps the deterministic rationale.
 */
export async function generateLikelihoodRationale(
  result: LikelihoodResult,
  accountId?: string,
  brandId?: string,
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const facts = result.breakdown
    .filter((b) => b.available && (b.subScore ?? 0) > 0)
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
    .map((b) => `- ${b.detail}${b.penalty ? " (this LOWERS likelihood)" : ""}`)
    .join("\n");
  if (!facts) return null;

  try {
    const response = await anthropic.messages.create({
      model: MODELS.haiku,
      max_tokens: 160,
      system:
        "You write a single, punchy sentence explaining why a journalist is or isn't likely to cover a PR pitch. Use ONLY the supplied signals — never invent facts, numbers, names, or outlets. Lead with the strongest reasons. Be concrete and specific, like a savvy PR strategist briefing a colleague. No preamble, no score, one sentence.",
      messages: [
        {
          role: "user",
          content: `Likelihood: ${result.score}%.\nSignals:\n${facts}\n\nWrite the one-sentence reason.`,
        },
      ],
    });

    if (accountId) {
      await logAIUsage({
        accountId,
        brandId: brandId ?? null,
        feature: "contacts.likelihood",
        model: MODELS.haiku,
        usage: response.usage,
      });
    }

    const text = response.content
      .filter((b): b is { type: "text"; text: string; citations: [] } => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();
    return text.length > 0 ? text : null;
  } catch (err) {
    console.error("generateLikelihoodRationale failed:", err);
    return null;
  }
}
