import {
  getCompanyProfile,
  upsertCompanyProfile,
  normalizeDomain,
} from "../cache";
import { crawlCompany } from "../sources/crawl";
import { recentNews } from "../sources/news";
import { companyLinkedinUrl } from "../sources/linkedin";
import { extractCompanyFacts } from "./extract";
import type { CompanyIntel, CompanyQuery, PersonRef } from "../types";

export type CompanyOptions = {
  /** Account to attribute AI-extraction token usage to (best-effort). */
  accountId?: string;
};

/**
 * Company Intelligence service (Tier-1, free, PUBLIC data). Assembles a
 * company profile from a website crawl + news, entirely from free sources,
 * and caches it globally so the first search for "OpenAI" pays the crawl
 * cost once and every later search — for any account — is a cache hit.
 *
 * Never spends paid credits. Email/phone are NOT part of this service; they
 * live in Contact Intelligence (per-account, paid-as-last-resort).
 */
export async function getCompanyIntel(
  query: CompanyQuery,
  opts: CompanyOptions = {},
): Promise<CompanyIntel | null> {
  const domain = await resolveDomain(query);
  if (!domain) return null;

  // 1. Global cache — the big win.
  const cached = await getCompanyProfile(domain);
  if (cached) return cached;

  // 2. Crawl (free). Bail to a news-only profile if the site is unreachable.
  const crawl = await crawlCompany(domain);
  const name = crawl?.name ?? query.name ?? domain;

  // 3. Recent press/coverage from Google News (free).
  const news = await recentNews(name, 10);

  // 4. AI extraction (paid-ish but cheap + cached once) pulls funding,
  //    awards, podcasts, and a cleaner exec list out of the crawled prose.
  //    Best-effort — merges over the free signals, never replaces them.
  const facts = await extractCompanyFacts({
    name,
    domain,
    textSample: crawl?.textSample,
    pressTitles: news.map((n) => n.title),
    accountId: opts.accountId,
  });

  const executives = mergeExecutives(crawl?.executives, facts?.executives);

  const intel: CompanyIntel = {
    name,
    domain,
    description: crawl?.description ?? facts?.description,
    linkedinUrl: companyLinkedinUrl(name, crawl?.linkedinUrl),
    executives: executives.length ? executives : undefined,
    socials: crawl && Object.keys(crawl.socials).length ? crawl.socials : undefined,
    pressPages: crawl?.pressPages ?? [],
    rssFeeds: crawl?.rssFeeds ?? [],
    pressReleases: news.length ? news : undefined,
    funding: facts?.funding,
    podcasts: facts?.podcasts,
    awards: facts?.awards,
    fromCache: false,
  };

  // 5. Cache forever (refreshed on next miss past the TTL window).
  await upsertCompanyProfile({ ...intel, domain });
  return intel;
}

/** Union executives from Schema.org and AI, deduped by lowercased name. */
function mergeExecutives(
  crawled?: PersonRef[],
  extracted?: PersonRef[],
): PersonRef[] {
  const byName = new Map<string, PersonRef>();
  for (const p of [...(crawled ?? []), ...(extracted ?? [])]) {
    const key = p.name.trim().toLowerCase();
    if (!key) continue;
    const existing = byName.get(key);
    if (existing) {
      // Prefer whichever has a title/url filled in.
      existing.title ??= p.title;
      existing.url ??= p.url;
    } else {
      byName.set(key, { ...p });
    }
  }
  return [...byName.values()].slice(0, 20);
}

/**
 * Resolve a query to a domain. Prefer an explicit domain; otherwise take a
 * best-effort ".com" slug guess and only accept it if the crawl actually
 * resolves to a real page. Weak by design — the paid providers (which map a
 * company name → domain server-side) fill the gap when this misses.
 */
async function resolveDomain(query: CompanyQuery): Promise<string | null> {
  if (query.domain) return normalizeDomain(query.domain);
  if (!query.name) return null;

  // If the user typed something domain-shaped, use it directly.
  if (/\.[a-z]{2,}$/i.test(query.name.trim())) {
    return normalizeDomain(query.name);
  }

  const slug = query.name
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
  if (!slug) return null;
  const guess = `${slug}.com`;
  const crawl = await crawlCompany(guess);
  return crawl?.name ? guess : null;
}
