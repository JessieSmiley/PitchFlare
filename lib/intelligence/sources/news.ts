import { queryGoogleNewsRss } from "@/lib/monitoring/sources";
import { getSourceCache, putSourceCache, normalizeDomain } from "../cache";
import type { LinkRef } from "../types";

/**
 * Tier-1 free source: recent news for a query via Google News RSS (already
 * used by coverage monitoring). Cached globally with a short TTL — news is
 * public and shared, but goes stale quickly.
 *
 * Besides headlines, Google News is our free outlet-domain oracle: each
 * <item> carries <source url="https://www.nytimes.com">The New York
 * Times</source>, which lets us map a typed outlet name to its real domain
 * without guessing slugs (the old `name + ".com"` guess broke on outlets
 * like the NYT, whose domain is nytimes.com).
 */

const NEWS_TTL_MS = 6 * 60 * 60 * 1000;

export type NewsItem = LinkRef & {
  sourceName?: string;
  sourceUrl?: string;
};

export async function recentNewsWithSources(
  query: string,
  limit = 30,
): Promise<NewsItem[]> {
  const key = `gnews2:${query.toLowerCase()}`;
  const cached = await getSourceCache<NewsItem[]>(key);
  if (cached) return cached.slice(0, limit);

  let hits: NewsItem[] = [];
  try {
    const raw = await queryGoogleNewsRss(query);
    hits = raw.map((h) => ({
      title: h.title,
      url: h.url,
      publishedAt: h.publishedAt?.toISOString(),
      sourceName: h.outletName ?? undefined,
      sourceUrl: h.outletUrl ?? undefined,
    }));
  } catch {
    hits = [];
  }
  await putSourceCache(key, "gnews", hits, NEWS_TTL_MS);
  return hits.slice(0, limit);
}

export async function recentNews(
  query: string,
  limit = 10,
): Promise<LinkRef[]> {
  const items = await recentNewsWithSources(query, limit);
  return items.map(({ title, url, publishedAt }) => ({
    title,
    url,
    publishedAt,
  }));
}

/**
 * Seed map of major outlets whose domains a slug guess can't derive.
 * Checked first — deterministic, zero network. Keys are normalized
 * (lowercase, alphanumeric only, leading "the" dropped).
 */
const KNOWN_OUTLETS: Record<string, string> = {
  newyorktimes: "nytimes.com",
  nytimes: "nytimes.com",
  nyt: "nytimes.com",
  washingtonpost: "washingtonpost.com",
  wallstreetjournal: "wsj.com",
  wsj: "wsj.com",
  guardian: "theguardian.com",
  bbc: "bbc.com",
  bbcnews: "bbc.com",
  cnn: "cnn.com",
  forbes: "forbes.com",
  techcrunch: "techcrunch.com",
  wired: "wired.com",
  verge: "theverge.com",
  bloomberg: "bloomberg.com",
  reuters: "reuters.com",
  associatedpress: "apnews.com",
  apnews: "apnews.com",
  axios: "axios.com",
  politico: "politico.com",
  atlantic: "theatlantic.com",
  fastcompany: "fastcompany.com",
  businessinsider: "businessinsider.com",
  fortune: "fortune.com",
  time: "time.com",
  usatoday: "usatoday.com",
  latimes: "latimes.com",
  losangelestimes: "latimes.com",
  npr: "npr.org",
  cnbc: "cnbc.com",
  arstechnica: "arstechnica.com",
  venturebeat: "venturebeat.com",
  information: "theinformation.com",
  vox: "vox.com",
};

function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/^the/, "");
}

/**
 * Resolve an outlet/company name to its real domain, free:
 *   1. Known-outlet seed map (deterministic).
 *   2. Google News <source url> whose source name matches the query.
 * Returns null when neither matches — callers fall back to a slug guess.
 */
export async function resolveOutletDomain(name: string): Promise<{
  domain: string;
  outletName?: string;
} | null> {
  const target = normName(name);
  if (!target) return null;

  const known = KNOWN_OUTLETS[target];
  if (known) return { domain: known, outletName: name };

  const items = await recentNewsWithSources(name, 40);
  // Tally matching sources; prefer the most frequent match.
  const tally = new Map<string, { count: number; sourceName: string }>();
  for (const item of items) {
    if (!item.sourceUrl || !item.sourceName) continue;
    const n = normName(item.sourceName);
    if (!n) continue;
    const matches =
      n === target ||
      n.includes(target) ||
      (target.includes(n) && n.length >= 4);
    if (!matches) continue;
    const domain = normalizeDomain(item.sourceUrl);
    const entry = tally.get(domain);
    if (entry) entry.count += 1;
    else tally.set(domain, { count: 1, sourceName: item.sourceName });
  }

  let best: { domain: string; count: number; sourceName: string } | null = null;
  for (const [domain, { count, sourceName }] of tally) {
    if (!best || count > best.count) best = { domain, count, sourceName };
  }
  return best ? { domain: best.domain, outletName: best.sourceName } : null;
}
