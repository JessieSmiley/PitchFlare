import { load as loadHtml } from "cheerio";

export type ScrapedAuthor = {
  name: string | null;
  title: string | null;
  outletName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  recentLinks: Array<{ title: string; url: string }>;
};

/**
 * Best-effort scrape of a journalist's author/profile page. Intentionally
 * defensive: every selector is optional, nothing throws on missing pieces.
 * The UI surfaces whatever we found with `AUTO_SCRAPED` provenance badges,
 * so users can tell AI-filled fields from fields they typed themselves.
 */
export async function scrapeAuthorPage(url: string): Promise<ScrapedAuthor> {
  const res = await fetch(url, {
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

  const ogSiteName = meta("og:site_name");
  const ogTitle = meta("og:title");
  const ogDescription = meta("og:description") ?? meta("description");
  const ogImage = meta("og:image");

  // Try common patterns for the author name.
  const nameGuesses = [
    $('[itemprop="name"]').first().text(),
    $(".author-name, .byline-name, .profile-name").first().text(),
    $("h1").first().text(),
    ogTitle ?? "",
  ]
    .map((s) => s?.trim())
    .filter(Boolean);
  const name = nameGuesses[0] || null;

  const titleGuesses = [
    $('[itemprop="jobTitle"]').first().text(),
    $(".author-title, .byline-title, .profile-title").first().text(),
  ]
    .map((s) => s?.trim())
    .filter(Boolean);
  const title = titleGuesses[0] || null;

  // Pull article links from anchor tags. Dedupe by href.
  const seen = new Set<string>();
  const recentLinks: ScrapedAuthor["recentLinks"] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    let abs: string;
    try {
      abs = new URL(href, url).toString();
    } catch {
      return;
    }
    if (seen.has(abs)) return;
    const text = $(el).text().trim();
    // Heuristic: article links usually have a title-length label.
    if (text.length < 20 || text.length > 160) return;
    // Skip navigation + same-author pages.
    if (/^(home|about|contact|subscribe|login|sign in)$/i.test(text)) return;
    seen.add(abs);
    recentLinks.push({ title: text, url: abs });
    if (recentLinks.length >= 10) return false;
  });

  return {
    name,
    title,
    outletName: ogSiteName,
    avatarUrl: ogImage ?? null,
    bio: ogDescription,
    recentLinks,
  };
}
