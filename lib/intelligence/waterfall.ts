import { getMediaIntel } from "./media";
import { getCompanyIntel } from "./company";
import { resolveContactEmail, type PaidResolver } from "./contact";
import { domainHasMx } from "./verify";
import { normalizeDomain } from "./cache";
import type { CompanySummary } from "./types";
import type { DiscoveredPerson } from "@/lib/providers/types";

/**
 * Top-level discovery orchestrator. Implements the cache-first waterfall:
 *
 *   customer searches company
 *        → own DB / global cache (via the services below)
 *        → free Tier-1 crawler + RSS bylines + news  (Media Intelligence)
 *        → free email permutation + heuristic verify (Contact Intelligence)
 *        → paid providers, ONLY if the free tiers came up short
 *        → cache everything
 *
 * The free path (Media Intelligence journalists + free email resolution)
 * runs first and is enough for most searches. Paid discovery (Hunter
 * domain-search) is only invoked to backfill when the free path returns
 * fewer than `minFreeResults` people AND a paid provider is connected.
 */

export type DiscoveryContext = {
  accountId: string;
  /** Paid email resolvers for Contact Intelligence (cheapest first). */
  paidResolvers?: PaidResolver[];
  /** Paid people-discovery fallback (e.g. Hunter domain-search). */
  paidDiscovery?: (query: {
    name?: string;
    domain?: string;
  }) => Promise<{ people: DiscoveredPerson[]; domain?: string }>;
  /** Free results below this count trigger the paid discovery backfill. */
  minFreeResults?: number;
};

export type DiscoveryOutcome = {
  people: DiscoveredPerson[];
  outletName?: string;
  domain?: string;
  /** Company snapshot (description, funding, awards, socials) for the header. */
  company: CompanySummary | null;
  /** True when we had to spend on paid discovery to fill the list. */
  usedPaidDiscovery: boolean;
};

export async function discoverContactsWaterfall(
  query: { name?: string; domain?: string },
  ctx: DiscoveryContext,
): Promise<DiscoveryOutcome> {
  const minFree = ctx.minFreeResults ?? 5;

  // --- Free tier: Media + Company Intelligence (crawl + RSS + news + AI) --
  const media = await getMediaIntel(query, { accountId: ctx.accountId });
  const domain = media.domain ? normalizeDomain(media.domain) : undefined;

  // Company Intelligence is a cache hit here (Media Intelligence just built
  // it), so this is effectively free — we surface it for the panel header.
  const companyIntel = await getCompanyIntel(query, {
    accountId: ctx.accountId,
  });
  const company: CompanySummary | null = companyIntel
    ? {
        name: companyIntel.name,
        domain: companyIntel.domain,
        description: companyIntel.description,
        linkedinUrl: companyIntel.linkedinUrl,
        socials: companyIntel.socials,
        funding: companyIntel.funding,
        executives: companyIntel.executives?.slice(0, 12),
        awards: companyIntel.awards,
        podcasts: companyIntel.podcasts,
        pressReleases: companyIntel.pressReleases?.slice(0, 8),
        pressPages: companyIntel.pressPages?.slice(0, 6),
      }
    : null;

  const free: DiscoveredPerson[] = [];
  for (const j of media.journalists.slice(0, 25)) {
    const contact = await resolveContactEmail(
      {
        fullName: j.fullName,
        domain,
        outletName: j.outletName,
      },
      { accountId: ctx.accountId, paidResolvers: ctx.paidResolvers },
    );
    free.push({
      fullName: j.fullName,
      title: j.title,
      outletName: j.outletName ?? media.publicationName,
      domain,
      email: contact.email,
      emailStatus: contact.emailStatus,
      emailSource: contact.emailSource,
      confidence: contact.confidence,
    });
  }

  // A generic PR/press inbox for the outlet (free, role-account).
  if (domain && (await domainHasMx(domain))) {
    free.unshift({
      fullName: `${media.publicationName ?? domain} — Press desk`,
      title: "PR / press contact",
      outletName: media.publicationName,
      domain,
      email: `press@${domain}`,
      emailStatus: "ACCEPT_ALL",
      emailSource: "PERMUTATION",
    });
  }

  const people = dedupe(free);

  // --- Paid tier: only if the free path came up short ---------------------
  let usedPaidDiscovery = false;
  if (people.length < minFree && ctx.paidDiscovery) {
    try {
      const paid = await ctx.paidDiscovery({
        name: query.name,
        domain: domain ?? query.domain,
      });
      if (paid.people.length > 0) {
        usedPaidDiscovery = true;
        for (const p of paid.people) {
          p.emailStatus ??= p.email ? "VALID" : undefined;
          p.emailSource ??= p.email ? "HUNTER" : undefined;
        }
        return {
          people: dedupe([...people, ...paid.people]),
          outletName: media.publicationName,
          domain: domain ?? paid.domain,
          company,
          usedPaidDiscovery,
        };
      }
    } catch {
      // Paid backfill is best-effort; return whatever the free path found.
    }
  }

  return {
    people,
    outletName: media.publicationName,
    domain,
    company,
    usedPaidDiscovery,
  };
}

/** Dedupe by email when present, else by normalized name. */
function dedupe(people: DiscoveredPerson[]): DiscoveredPerson[] {
  const seen = new Set<string>();
  const out: DiscoveredPerson[] = [];
  for (const p of people) {
    const key = (p.email ?? p.fullName).trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}
