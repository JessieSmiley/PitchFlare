import { load as loadHtml } from "cheerio";

export type MonitoringHit = {
  dedupeKey: string;
  url: string;
  title: string;
  excerpt: string | null;
  outletName: string | null;
  author: string | null;
  publishedAt: Date | null;
  sourceProvider: "GOOGLE_NEWS_RSS" | "GDELT" | "BING_NEWS";
};

/**
 * Query Google News RSS for a keyword. Free, unauthenticated, and returns
 * both the article link and the source outlet. Results rank by relevance
 * by default; we sort by publishedAt descending after fetching.
 *
 * Not a production monitoring pipeline — it's the v1 zero-cost option per
 * SPEC.md §4. The `MonitoringProvider` abstraction lets us swap in
 * NewsWhip/Meltwater at tier-upgrade time without touching CoverageClip.
 */
export async function queryGoogleNewsRss(
  keyword: string,
): Promise<MonitoringHit[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetch(url, {
    headers: { "User-Agent": "PitchFlare/1.0 (+https://pitchflare.com)" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Google News RSS HTTP ${res.status}`);
  const xml = await res.text();
  const $ = loadHtml(xml, { xmlMode: true });

  const hits: MonitoringHit[] = [];
  $("item").each((_, el) => {
    const $el = $(el);
    const title = $el.find("title").text().trim();
    const link = $el.find("link").text().trim();
    const pubDate = $el.find("pubDate").text().trim();
    const source = $el.find("source").text().trim() || null;
    const description = $el.find("description").text().trim() || null;

    if (!title || !link) return;
    const publishedAt = pubDate ? new Date(pubDate) : null;

    hits.push({
      // Google News URLs wrap the real URL with a redirect; the link
      // itself is stable enough to use for dedupe.
      dedupeKey: `google:${link}`,
      url: link,
      title,
      excerpt: stripHtml(description)?.slice(0, 500) ?? null,
      outletName: source,
      author: null,
      publishedAt,
      sourceProvider: "GOOGLE_NEWS_RSS",
    });
  });

  hits.sort((a, b) => {
    const ta = a.publishedAt?.getTime() ?? 0;
    const tb = b.publishedAt?.getTime() ?? 0;
    return tb - ta;
  });
  return hits;
}

function stripHtml(s: string | null): string | null {
  if (!s) return null;
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
