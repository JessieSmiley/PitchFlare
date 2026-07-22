import { load as loadHtml } from "cheerio";
import { getSourceCache, putSourceCache } from "../cache";
import type { NewsItem } from "./news";
import type { LinkRef } from "../types";

/**
 * Tier-1 free source: mine journalist bylines from article pages. Google
 * News gives us article URLs for an outlet; the articles themselves carry
 * authors in Schema.org JSON-LD (`NewsArticle.author`) or <meta
 * name="author"> — public byline data, no profile scraping. Per-URL results
 * are cached globally for a week, and each mining pass fetches a bounded
 * handful of pages in parallel.
 */

const AUTHOR_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8_000;

export async function extractAuthorsFromArticle(
  url: string,
): Promise<string[]> {
  const key = `authors:${url}`;
  const cached = await getSourceCache<string[]>(key);
  if (cached) return cached;

  let authors: string[] = [];
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "PitchFlare/1.0 (+https://pitchflare.com)" },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.ok) {
      const html = await res.text();
      authors = extractAuthorsFromHtml(html);
    }
  } catch {
    authors = [];
  }

  await putSourceCache(key, "authors", authors, AUTHOR_TTL_MS);
  return authors;
}

export function extractAuthorsFromHtml(html: string): string[] {
  const $ = loadHtml(html);
  const names = new Set<string>();

  // Schema.org JSON-LD — NewsArticle/Article author(s).
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    collectAuthorNames(parsed, names);
  });

  // <meta name="author"> and common byline metas.
  for (const sel of [
    'meta[name="author"]',
    'meta[name="parsely-author"]',
    'meta[property="article:author"]',
  ]) {
    $(sel).each((_, el) => {
      const v = $(el).attr("content");
      // article:author is sometimes a URL — skip those.
      if (v && !/^https?:\/\//i.test(v)) {
        for (const n of splitByline(v)) names.add(n);
      }
    });
  }

  return [...names].filter(isLikelyPersonName).slice(0, 10);
}

/** Walk arbitrary JSON-LD collecting author names from Article-ish nodes. */
function collectAuthorNames(node: unknown, out: Set<string>, depth = 0): void {
  if (!node || typeof node !== "object" || depth > 6) return;
  if (Array.isArray(node)) {
    for (const n of node) collectAuthorNames(n, out, depth + 1);
    return;
  }
  const obj = node as Record<string, unknown>;

  const author = obj.author;
  if (author) {
    const entries = Array.isArray(author) ? author : [author];
    for (const a of entries) {
      if (typeof a === "string") {
        for (const n of splitByline(a)) out.add(n);
      } else if (a && typeof a === "object") {
        const ao = a as Record<string, unknown>;
        // Skip Organization authors — we want people.
        const type = String(ao["@type"] ?? "");
        if (/organization/i.test(type)) continue;
        if (typeof ao.name === "string") {
          for (const n of splitByline(ao.name)) out.add(n);
        }
      }
    }
  }

  const graph = obj["@graph"];
  if (graph) collectAuthorNames(graph, out, depth + 1);
}

/**
 * Split multi-author bylines ("Ben Casselman and Joe Rennison",
 * "A, B and C", "By Jane Doe") into individual names.
 */
export function splitByline(raw: string): string[] {
  return raw
    .replace(/^by\s+/i, "")
    .split(/,|\band\b|&/i)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Person-name sniff: 2–4 capitalized-ish words, no @, sane length. */
export function isLikelyPersonName(s: string): boolean {
  if (!s || s.length > 60 || s.includes("@")) return false;
  // Collective/desk bylines aren't people ("The Editorial Board", "Staff").
  if (/\b(staff|newsroom|editorial|news\s*desk|team|bureau|board|contributors?)\b/i.test(s)) {
    return false;
  }
  const words = s.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  return /^[\p{L}][\p{L}'.-]*$/u.test(words[0]);
}

export type MinedAuthor = {
  fullName: string;
  articles: LinkRef[];
};

/**
 * Mine authors from an outlet's recent news items. Only fetches articles
 * actually published by the outlet (source URL host matches), bounded to
 * `maxFetches` pages per call.
 */
export async function mineAuthorsFromNews(
  items: NewsItem[],
  domain: string,
  maxFetches = 5,
): Promise<MinedAuthor[]> {
  const fromOutlet = items.filter((i) => {
    if (!i.sourceUrl) return false;
    try {
      return new URL(i.sourceUrl).hostname
        .replace(/^www\./, "")
        .endsWith(domain);
    } catch {
      return false;
    }
  });
  const targets = fromOutlet.slice(0, maxFetches);
  if (targets.length === 0) return [];

  const results = await Promise.allSettled(
    targets.map((t) => extractAuthorsFromArticle(t.url)),
  );

  const byAuthor = new Map<string, MinedAuthor>();
  results.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    const item = targets[i];
    for (const name of r.value) {
      const key = name.toLowerCase();
      const article: LinkRef = {
        title: item.title,
        url: item.url,
        publishedAt: item.publishedAt,
      };
      const existing = byAuthor.get(key);
      if (existing) existing.articles.push(article);
      else byAuthor.set(key, { fullName: name, articles: [article] });
    }
  });

  return [...byAuthor.values()];
}
