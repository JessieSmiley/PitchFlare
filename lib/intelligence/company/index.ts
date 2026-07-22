import {
  getCompanyProfile,
  upsertCompanyProfile,
  normalizeDomain,
} from "../cache";
import { crawlCompany } from "../sources/crawl";
import { recentNews } from "../sources/news";
import { companyLinkedinUrl } from "../sources/linkedin";
import type { CompanyIntel, CompanyQuery } from "../types";

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

  const intel: CompanyIntel = {
    name,
    domain,
    description: crawl?.description,
    linkedinUrl: companyLinkedinUrl(name, crawl?.linkedinUrl),
    executives: crawl?.executives?.length ? crawl.executives : undefined,
    socials: crawl && Object.keys(crawl.socials).length ? crawl.socials : undefined,
    pressPages: crawl?.pressPages ?? [],
    rssFeeds: crawl?.rssFeeds ?? [],
    pressReleases: news.length ? news : undefined,
    fromCache: false,
  };

  // 4. Cache forever (refreshed on next miss past the TTL window).
  await upsertCompanyProfile({ ...intel, domain });
  return intel;
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
