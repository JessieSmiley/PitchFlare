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

/**
 * Big publishers rarely advertise feeds in their homepage <head> (the NYT
 * homepage has zero <link rel="alternate" type="rss"> tags — its feeds live
 * at rss.nytimes.com). So when the crawl finds nothing we probe: a seed map
 * of known publisher feeds first, then common feed paths, accepting only
 * URLs that actually parse to ≥1 item. Results cached globally for a week.
 */
const KNOWN_FEEDS: Record<string, string[]> = {
  "nytimes.com": [
    "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
    "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",
    "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
  ],
  "washingtonpost.com": [
    "https://feeds.washingtonpost.com/rss/business/technology",
    "https://feeds.washingtonpost.com/rss/national",
  ],
  "wsj.com": ["https://feeds.content.dowjones.io/public/rss/RSSWSJD"],
  "theguardian.com": ["https://www.theguardian.com/international/rss"],
  "cnn.com": ["http://rss.cnn.com/rss/cnn_topstories.rss"],
  "bbc.com": ["https://feeds.bbci.co.uk/news/rss.xml"],
  "theverge.com": ["https://www.theverge.com/rss/index.xml"],
  "wired.com": ["https://www.wired.com/feed/rss"],
  "npr.org": ["https://feeds.npr.org/1001/rss.xml"],
};

const COMMON_FEED_PATHS = [
  "/rss",
  "/feed",
  "/feed/",
  "/rss.xml",
  "/feed.xml",
  "/atom.xml",
  "/index.xml",
  "/arc/outboundfeeds/rss/?outputType=xml",
];

const PROBE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function probeFeeds(
  domain: string,
  max = 3,
): Promise<string[]> {
  const key = `feedprobe:${domain.toLowerCase()}`;
  const cached = await getSourceCache<string[]>(key);
  if (cached) return cached;

  const candidates = [
    ...(KNOWN_FEEDS[domain] ?? []),
    ...COMMON_FEED_PATHS.map((p) => `https://${domain}${p}`),
    ...COMMON_FEED_PATHS.map((p) => `https://www.${domain}${p}`),
  ];

  const found: string[] = [];
  // Probe in small parallel batches so one dead path doesn't serialize the
  // rest, but we stop as soon as we have enough working feeds.
  const BATCH = 4;
  for (let i = 0; i < candidates.length && found.length < max; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map((u) => fetchFeed(u)));
    results.forEach((r, j) => {
      if (
        r.status === "fulfilled" &&
        r.value.length > 0 &&
        found.length < max
      ) {
        found.push(batch[j]);
      }
    });
  }

  await putSourceCache(key, "feedprobe", found, PROBE_TTL_MS);
  return found;
}
