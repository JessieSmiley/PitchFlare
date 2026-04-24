import { db } from "@/lib/db";
import type { ContactKind } from "@prisma/client";

/**
 * Compute a 0-100 match score between a contact and a campaign angle.
 *
 * Formula from the build guide (Prompt 7):
 *   (beat overlap       × 0.5)
 * + (recent-work keyword × 0.3)
 * + (contact type match  × 0.2)
 *
 * Plenty of room to improve later (TF-IDF, vector sim, semantic beat
 * matching). We keep it rule-based here so scores are explainable — a
 * journalist who shows up at 84 should be easy to trace back to "matched
 * on 'saas' + 'fintech' + a recent article mentioning 'series B'".
 */
export type MatchInputs = {
  campaignAngleTerms: string[];
  preferredMediaTypes: ContactKind[];
};

export type ScoredContact = {
  contactId: string;
  score: number;
  breakdown: {
    beat: number;
    recentWork: number;
    type: number;
  };
};

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

export async function scoreContactsForCampaign(
  brandId: string,
  inputs: MatchInputs,
  opts: { limit?: number; kindFilter?: ContactKind[] } = {},
): Promise<ScoredContact[]> {
  const angleTokens = new Set(
    inputs.campaignAngleTerms.flatMap(tokenize),
  );
  const preferredKinds = new Set(inputs.preferredMediaTypes);

  // Fetch candidate contacts. We scope to contacts that have at least one
  // beat OR at least one recent work entry — pure-metadata rows won't
  // score meaningfully and would noise up the ranking.
  const contacts = await db.contact.findMany({
    where: {
      ...(opts.kindFilter ? { kind: { in: opts.kindFilter } } : {}),
      OR: [
        { beats: { some: {} } },
        { recentWork: { some: {} } },
      ],
    },
    select: {
      id: true,
      kind: true,
      beats: { select: { beat: { select: { name: true } } } },
      recentWork: {
        select: { title: true, excerpt: true },
        orderBy: { publishedAt: "desc" },
        take: 8,
      },
    },
    take: 500, // sanity cap; paginate later
  });

  const scored: ScoredContact[] = contacts.map((c) => {
    // Beat overlap: fraction of the contact's beats that overlap angle tokens.
    const beatMatches = c.beats.filter((cb) => {
      const n = cb.beat.name.toLowerCase();
      return [...angleTokens].some((t) => n.includes(t) || t.includes(n));
    });
    const beatScore = c.beats.length
      ? beatMatches.length / c.beats.length
      : 0;

    // Recent work: fraction of recent titles that mention any angle token.
    const rwMatches = c.recentWork.filter((rw) => {
      const hay = `${rw.title} ${rw.excerpt ?? ""}`.toLowerCase();
      return [...angleTokens].some((t) => hay.includes(t));
    });
    const rwScore = c.recentWork.length
      ? rwMatches.length / c.recentWork.length
      : 0;

    const typeScore = preferredKinds.size === 0
      ? 0.5
      : preferredKinds.has(c.kind)
        ? 1
        : 0;

    const raw = beatScore * 0.5 + rwScore * 0.3 + typeScore * 0.2;
    const score = Math.round(raw * 100);
    return {
      contactId: c.id,
      score,
      breakdown: {
        beat: Math.round(beatScore * 100),
        recentWork: Math.round(rwScore * 100),
        type: Math.round(typeScore * 100),
      },
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, opts.limit ?? 50);
}
