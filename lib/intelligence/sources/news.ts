import { queryGoogleNewsRss } from "@/lib/monitoring/sources";
import { getSourceCache, putSourceCache } from "../cache";
import type { LinkRef } from "../types";

/**
 * Tier-1 free source: recent news for a query via Google News RSS (already
 * used by coverage monitoring). Cached globally with a short TTL — news is
 * public and shared, but goes stale quickly. Used for a company's recent
 * press releases / coverage and to surface outlets covering a topic.
 */

const NEWS_TTL_MS = 6 * 60 * 60 * 1000;

export async function recentNews(
  query: string,
  limit = 10,
): Promise<LinkRef[]> {
  const key = `gnews:${query.toLowerCase()}`;
  const cached = await getSourceCache<LinkRef[]>(key);
  if (cached) return cached.slice(0, limit);

  let hits: LinkRef[] = [];
  try {
    const raw = await queryGoogleNewsRss(query);
    hits = raw.map((h) => ({
      title: h.outletName ? `${h.title}` : h.title,
      url: h.url,
      publishedAt: h.publishedAt?.toISOString(),
    }));
  } catch {
    hits = [];
  }
  await putSourceCache(key, "gnews", hits, NEWS_TTL_MS);
  return hits.slice(0, limit);
}
