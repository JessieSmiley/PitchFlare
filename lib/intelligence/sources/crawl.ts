import { load as loadHtml } from "cheerio";
import { getSourceCache, putSourceCache, normalizeDomain } from "../cache";
import type { CrawlResult, PersonRef } from "../types";

/**
 * Tier-1 free source: crawl a company's homepage and extract structured,
 * public metadata — Schema.org (Organization/NewsMediaOrganization),
 * OpenGraph, socials (sameAs), press/newsroom links, and RSS feeds. Never
 * touches a paid API. The raw result is cached globally so a domain is
 * crawled once and reused across every account.
 */

const CRAWL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const SOCIAL_HOSTS: Record<string, string> = {
  "twitter.com": "twitter",
  "x.com": "twitter",
  "linkedin.com": "linkedin",
  "facebook.com": "facebook",
  "instagram.com": "instagram",
  "youtube.com": "youtube",
  "tiktok.com": "tiktok",
};

const PRESS_HINTS = ["press", "news", "newsroom", "media", "press-releases"];

export async function crawlCompany(
  domainOrUrl: string,
): Promise<CrawlResult | null> {
  const domain = normalizeDomain(domainOrUrl);
  if (!domain || !domain.includes(".")) return null;

  const cacheKey = `crawl:${domain}`;
  const cached = await getSourceCache<CrawlResult>(cacheKey);
  if (cached) return cached;

  let html: string;
  try {
    const res = await fetch(`https://${domain}/`, {
      headers: { "User-Agent": "PitchFlare/1.0 (+https://pitchflare.com)" },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return cacheNull(cacheKey, domain);
    html = await res.text();
  } catch {
    return cacheNull(cacheKey, domain);
  }

  const $ = loadHtml(html);
  const meta = (n: string) =>
    $(`meta[property="${n}"]`).attr("content") ??
    $(`meta[name="${n}"]`).attr("content") ??
    undefined;

  const socials: Record<string, string> = {};
  let linkedinUrl: string | undefined;
  const executives: PersonRef[] = [];
  let schemaName: string | undefined;
  let schemaDesc: string | undefined;
  let logoUrl: string | undefined;

  // Schema.org JSON-LD — the richest structured source when present.
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    const nodes = Array.isArray(parsed) ? parsed : [parsed];
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const obj = node as Record<string, unknown>;
      const graph = obj["@graph"];
      const entries = Array.isArray(graph) ? graph : [obj];
      for (const e of entries) {
        if (!e || typeof e !== "object") continue;
        const ent = e as Record<string, unknown>;
        const type = String(ent["@type"] ?? "");
        if (/Organization|NewsMediaOrganization|Corporation/i.test(type)) {
          if (typeof ent.name === "string") schemaName ??= ent.name;
          if (typeof ent.description === "string")
            schemaDesc ??= ent.description;
          const logo = ent.logo;
          if (typeof logo === "string") logoUrl ??= logo;
          else if (logo && typeof logo === "object" && "url" in logo) {
            const u = (logo as Record<string, unknown>).url;
            if (typeof u === "string") logoUrl ??= u;
          }
          const sameAs = ent.sameAs;
          const links = Array.isArray(sameAs)
            ? sameAs
            : typeof sameAs === "string"
              ? [sameAs]
              : [];
          for (const link of links) {
            if (typeof link === "string") classifySocial(link, socials);
          }
        }
        if (/Person/i.test(type) && typeof ent.name === "string") {
          executives.push({
            name: ent.name,
            title:
              typeof ent.jobTitle === "string" ? ent.jobTitle : undefined,
            url: typeof ent.url === "string" ? ent.url : undefined,
          });
        }
      }
    }
  });

  // Anchor sweep for socials + press/newsroom links + RSS.
  const pressPages = new Set<string>();
  const rssFeeds = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const abs = absolute(href, domain);
    if (!abs) return;
    classifySocial(abs, socials);
    const path = abs.toLowerCase();
    if (
      PRESS_HINTS.some((h) => path.includes(`/${h}`)) &&
      sameHost(abs, domain)
    ) {
      pressPages.add(abs);
    }
  });

  // RSS/Atom feed discovery from <link rel="alternate">.
  $('link[rel="alternate"]').each((_, el) => {
    const type = ($(el).attr("type") ?? "").toLowerCase();
    const href = $(el).attr("href");
    if (!href) return;
    if (type.includes("rss") || type.includes("atom")) {
      const abs = absolute(href, domain);
      if (abs) rssFeeds.add(abs);
    }
  });

  if (socials.linkedin) linkedinUrl = socials.linkedin;

  // Bounded plain-text sample for downstream AI extraction. Strip scripts/
  // styles first so we don't feed JS/CSS to the model.
  $("script, style, noscript, svg").remove();
  const textSample = $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);

  const result: CrawlResult = {
    domain,
    name: schemaName ?? meta("og:site_name") ?? undefined,
    description: schemaDesc ?? meta("og:description") ?? meta("description"),
    logoUrl: logoUrl ?? meta("og:image"),
    linkedinUrl,
    socials,
    executives: executives.slice(0, 20),
    pressPages: [...pressPages].slice(0, 10),
    rssFeeds: [...rssFeeds].slice(0, 10),
    textSample: textSample || undefined,
  };

  await putSourceCache(cacheKey, "crawl", result, CRAWL_TTL_MS);
  return result;
}

function cacheNull(key: string, domain: string): null {
  // Cache a minimal shell briefly so a dead domain isn't re-fetched on every
  // keystroke; short TTL so transient outages recover.
  void putSourceCache(
    key,
    "crawl",
    { domain, socials: {}, executives: [], pressPages: [], rssFeeds: [] },
    60 * 60 * 1000,
  );
  return null;
}

function classifySocial(url: string, into: Record<string, string>) {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return;
  }
  for (const [needle, key] of Object.entries(SOCIAL_HOSTS)) {
    if (host === needle || host.endsWith(`.${needle}`)) {
      into[key] ??= url;
      return;
    }
  }
}

function absolute(href: string, domain: string): string | null {
  try {
    if (href.startsWith("http")) return href;
    if (href.startsWith("//")) return `https:${href}`;
    if (href.startsWith("/")) return `https://${domain}${href}`;
    return null;
  } catch {
    return null;
  }
}

function sameHost(url: string, domain: string): boolean {
  try {
    return new URL(url).hostname.replace(/^www\./, "") === domain;
  } catch {
    return false;
  }
}
