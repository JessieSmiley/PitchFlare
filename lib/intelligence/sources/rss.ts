import { load as loadHtml } from "cheerio";
import { getSourceCache, putSourceCache } from "../cache";
import type { LinkRef } from "../types";

/**
 * Tier-1 free source: parse an outlet's RSS/Atom feed for recent articles
 * and — crucially for Media Intelligence — their bylined authors. Feed
 * <author>/<dc:creator> tags are the free, ToS-clean way to surface which
 * journalists write for a publication (no profile scraping). Cached
 * globally with a short TTL.
 */

const RSS_TTL_MS = 3 * 60 * 60 * 1000;

export type FeedItem = LinkRef & { author?: string };

export async function fetchFeed(feedUrl: string): Promise<FeedItem[]> {
  const key = `rss:${feedUrl}`;
  const cached = await getSourceCache<FeedItem[]>(key);
  if (cached) return cached;

  let items: FeedItem[] = [];
  try {
    const res = await fetch(feedUrl, {
      headers: { "User-Agent": "PitchFlare/1.0 (+https://pitchflare.com)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const xml = await res.text();
      items = parseFeed(xml);
    }
  } catch {
    items = [];
  }
  await putSourceCache(key, "rss", items, RSS_TTL_MS);
  return items;
}

function parseFeed(xml: string): FeedItem[] {
  const $ = loadHtml(xml, { xmlMode: true });
  const items: FeedItem[] = [];

  // RSS <item> and Atom <entry> both handled.
  $("item, entry").each((_, el) => {
    const $el = $(el);
    const title = $el.find("title").first().text().trim();
    // RSS uses <link>text; Atom uses <link href="">.
    const link =
      $el.find("link").first().text().trim() ||
      $el.find("link").first().attr("href") ||
      "";
    const dateRaw =
      $el.find("pubDate").first().text().trim() ||
      $el.find("published").first().text().trim() ||
      $el.find("updated").first().text().trim();
    const author =
      $el.find("dc\\:creator").first().text().trim() ||
      $el.find("author > name").first().text().trim() ||
      $el.find("author").first().text().trim() ||
      undefined;

    if (!title || !link) return;
    items.push({
      title,
      url: link,
      publishedAt: dateRaw ? safeIso(dateRaw) : undefined,
      author: author || undefined,
    });
  });

  return items.slice(0, 30);
}

function safeIso(s: string): string | undefined {
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}
