"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { load as loadHtml } from "cheerio";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import { queryGoogleNewsRss } from "@/lib/monitoring/sources";
import { scoreSentimentForClip } from "@/lib/monitoring/sentiment";

type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

async function requireCampaign(campaignId: string) {
  const tenant = await requireTenant();
  const campaign = await db.campaign.findFirst({
    where: {
      id: campaignId,
      brand: { accountId: tenant.account.id },
    },
    include: { brand: { select: { id: true, name: true } } },
  });
  if (!campaign) throw new Error("Campaign not found in current account.");
  return { tenant, campaign };
}

const AddCoverageInput = z.object({
  campaignId: z.string().min(1),
  url: z.string().trim().url(),
});

/**
 * Manual coverage entry. Fetches the URL, extracts a headline + excerpt,
 * asks Claude Haiku for sentiment + rough reach, and writes the
 * CoverageClip + SentimentAnalysis rows.
 */
export async function addCoverageFromUrl(
  input: z.infer<typeof AddCoverageInput>,
): Promise<ActionResult<{ clipId: string }>> {
  const parsed = AddCoverageInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid URL" };
  }
  const { tenant, campaign } = await requireCampaign(parsed.data.campaignId);

  let headline: string | null = null;
  let excerpt: string | null = null;
  let outletName: string | null = null;
  let publishedAt: Date | null = null;
  let domain: string | null = null;
  try {
    domain = new URL(parsed.data.url).hostname.replace(/^www\./, "");
  } catch {
    return { ok: false, error: "Invalid URL." };
  }

  try {
    const res = await fetch(parsed.data.url, {
      headers: { "User-Agent": "PitchFlare/1.0 (+https://pitchflare.com)" },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const $ = loadHtml(html);
    const meta = (name: string) =>
      $(`meta[property="${name}"]`).attr("content") ??
      $(`meta[name="${name}"]`).attr("content") ??
      null;

    headline = meta("og:title") ?? $("h1").first().text().trim() || null;
    excerpt = meta("og:description") ?? meta("description") ?? null;
    outletName = meta("og:site_name") ?? domain;
    const pubMeta = meta("article:published_time") ?? meta("pubdate");
    publishedAt = pubMeta ? new Date(pubMeta) : null;
  } catch (e) {
    return {
      ok: false,
      error: `Could not fetch ${parsed.data.url}. ${e instanceof Error ? e.message : ""}`.trim(),
    };
  }

  if (!headline) {
    return { ok: false, error: "Couldn't extract a headline from that URL." };
  }

  const outlet = domain
    ? await db.outlet.upsert({
        where: { domain },
        create: {
          name: outletName ?? domain,
          domain,
          kind: "PUBLICATION",
        },
        update: {},
      })
    : null;

  const sentiment = await scoreSentimentForClip({
    brandName: campaign.brand.name,
    clipTitle: headline,
    outlet: outletName,
    excerpt,
    accountId: tenant.account.id,
    brandId: campaign.brand.id,
  });

  const clip = await db.coverageClip.create({
    data: {
      brandId: campaign.brand.id,
      campaignId: campaign.id,
      url: parsed.data.url,
      headline,
      excerpt,
      publishedAt,
      outletId: outlet?.id ?? null,
      reachEstimate: sentiment?.reachEstimate ?? null,
      sentimentScore: sentiment?.score ?? null,
      sentimentLabel: sentiment?.label ?? null,
      sentimentAnalysis: sentiment
        ? {
            create: {
              score: sentiment.score,
              label: sentiment.label,
              confidence: sentiment.confidence,
              rationale: sentiment.rationale,
              modelUsed: "claude-haiku-4-5",
            },
          }
        : undefined,
    },
    select: { id: true },
  });

  revalidatePath("/dashboard/analyze");
  return { ok: true, clipId: clip.id };
}

const RunMonitoringInput = z.object({
  campaignId: z.string().min(1),
  /** Optional keyword override; defaults to brand name + campaign title. */
  keywords: z.array(z.string().trim().min(1)).optional(),
  /** Cap per-run results so a huge query doesn't blow the DB. */
  limit: z.number().int().min(1).max(100).default(25),
});

/**
 * One monitoring pass for a single campaign. Called by the cron endpoint
 * per active MonitoringQuery, and by the "Run now" button on the Analyze
 * UI. Deduplicates by (provider, url) to avoid double-counting.
 */
export async function runMonitoringOnce(
  input: z.infer<typeof RunMonitoringInput>,
): Promise<ActionResult<{ inserted: number; skipped: number }>> {
  const parsed = RunMonitoringInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { campaign } = await requireCampaign(parsed.data.campaignId);

  const keywords =
    parsed.data.keywords && parsed.data.keywords.length
      ? parsed.data.keywords
      : [campaign.brand.name, campaign.title].filter(Boolean);

  // Ensure there's a MonitoringQuery row so ingestion is traceable.
  const query = await db.monitoringQuery.upsert({
    where: {
      // No compound unique key on (brandId, campaignId) — look up manually.
      id:
        (
          await db.monitoringQuery.findFirst({
            where: {
              brandId: campaign.brand.id,
              campaignId: campaign.id,
            },
            select: { id: true },
          })
        )?.id ?? "__never__",
    },
    update: {
      keywords,
      sources: ["GOOGLE_NEWS_RSS"],
      lastRunAt: new Date(),
    },
    create: {
      brandId: campaign.brand.id,
      campaignId: campaign.id,
      keywords,
      sources: ["GOOGLE_NEWS_RSS"],
      lastRunAt: new Date(),
    },
  });

  let inserted = 0;
  let skipped = 0;
  for (const kw of keywords) {
    const hits = await queryGoogleNewsRss(kw);
    for (const hit of hits.slice(0, parsed.data.limit)) {
      const existing = await db.mention.findUnique({
        where: { dedupeKey: hit.dedupeKey },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      await db.mention.create({
        data: {
          monitoringQueryId: query.id,
          dedupeKey: hit.dedupeKey,
          url: hit.url,
          title: hit.title,
          excerpt: hit.excerpt,
          outletName: hit.outletName,
          author: hit.author,
          publishedAt: hit.publishedAt,
          sourceProvider: hit.sourceProvider,
        },
      });
      inserted += 1;
    }
  }

  revalidatePath("/dashboard/analyze");
  return { ok: true, inserted, skipped };
}

/**
 * Promote a raw Mention → CoverageClip. Runs sentiment synchronously so
 * the user sees a ranked clip immediately. Idempotent on re-promote.
 */
export async function promoteMentionToClip(input: {
  mentionId: string;
  campaignId: string;
}): Promise<ActionResult<{ clipId: string }>> {
  const { tenant, campaign } = await requireCampaign(input.campaignId);
  const mention = await db.mention.findUnique({
    where: { id: input.mentionId },
  });
  if (!mention) return { ok: false, error: "Mention not found." };
  const existing = await db.coverageClip.findFirst({
    where: { mentionId: mention.id },
    select: { id: true },
  });
  if (existing) {
    return { ok: true, clipId: existing.id };
  }

  const sentiment = await scoreSentimentForClip({
    brandName: campaign.brand.name,
    clipTitle: mention.title,
    outlet: mention.outletName,
    excerpt: mention.excerpt,
    accountId: tenant.account.id,
    brandId: campaign.brand.id,
  });

  const clip = await db.coverageClip.create({
    data: {
      brandId: campaign.brand.id,
      campaignId: campaign.id,
      mentionId: mention.id,
      url: mention.url,
      headline: mention.title,
      excerpt: mention.excerpt,
      publishedAt: mention.publishedAt,
      reachEstimate: sentiment?.reachEstimate ?? null,
      sentimentScore: sentiment?.score ?? null,
      sentimentLabel: sentiment?.label ?? null,
      sentimentAnalysis: sentiment
        ? {
            create: {
              score: sentiment.score,
              label: sentiment.label,
              confidence: sentiment.confidence,
              rationale: sentiment.rationale,
              modelUsed: "claude-haiku-4-5",
            },
          }
        : undefined,
    },
    select: { id: true },
  });

  revalidatePath("/dashboard/analyze");
  return { ok: true, clipId: clip.id };
}
