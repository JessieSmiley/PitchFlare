import { getCompanyIntel } from "../company";
import { fetchFeed, probeFeeds } from "../sources/rss";
import { recentNewsWithSources } from "../sources/news";
import {
  mineAuthorsFromNews,
  splitByline,
  isLikelyPersonName,
} from "../sources/articles";
import type {
  JournalistLead,
  LinkRef,
  MediaIntel,
  MediaQuery,
} from "../types";

/**
 * Media Intelligence service (Tier-1, free, PUBLIC data). Surfaces the
 * publication, its recent articles, and the journalists writing for it.
 * Journalist leads come from two free, ToS-clean byline sources (no profile
 * scraping):
 *
 *   1. RSS feed byline tags (<dc:creator>/<author>) — feeds from the crawl
 *      when the homepage advertises them, else probed from known publisher
 *      feeds + common paths (big outlets like the NYT advertise nothing on
 *      their homepage).
 *   2. Schema.org JSON-LD / meta-author bylines mined from the outlet's own
 *      recent articles surfaced by Google News.
 *
 * Never spends paid credits. Contact details for these journalists are
 * resolved separately, on demand, by Contact Intelligence.
 */
export async function getMediaIntel(
  query: MediaQuery,
  opts: { accountId?: string } = {},
): Promise<MediaIntel> {
  const company = await getCompanyIntel(
    { name: query.name, domain: query.domain },
    { accountId: opts.accountId },
  );

  const publicationName = company?.name ?? query.name;
  const domain = company?.domain ?? query.domain;

  // Feeds: crawl-advertised first, probed fallback second.
  let feeds = company?.rssFeeds ?? [];
  if (feeds.length === 0 && domain) {
    feeds = await probeFeeds(domain);
  }
  const feedItems = (
    await Promise.all(feeds.slice(0, 3).map((f) => fetchFeed(f)))
  ).flat();

  // Recent outlet coverage from Google News (also feeds author mining).
  const newsItems = await recentNewsWithSources(
    publicationName ?? query.name ?? "",
    30,
  );

  const recentArticles: LinkRef[] = feedItems.length
    ? feedItems.map((i) => ({
        title: i.title,
        url: i.url,
        publishedAt: i.publishedAt,
      }))
    : newsItems.map(({ title, url, publishedAt }) => ({
        title,
        url,
        publishedAt,
      }));

  // --- Journalist leads: RSS bylines + article-page mining, merged --------
  const byAuthor = new Map<string, JournalistLead>();
  const addLead = (name: string, article: LinkRef) => {
    const key = name.toLowerCase();
    const existing = byAuthor.get(key);
    if (existing) {
      existing.articles.push(article);
    } else {
      byAuthor.set(key, {
        fullName: name,
        outletName: publicationName ?? undefined,
        articles: [article],
        beats: [],
      });
    }
  };

  for (const item of feedItems) {
    const article: LinkRef = {
      title: item.title,
      url: item.url,
      publishedAt: item.publishedAt,
    };
    for (const name of authorsFromByline(item.author)) {
      addLead(name, article);
    }
  }

  if (domain) {
    const mined = await mineAuthorsFromNews(newsItems, domain);
    for (const m of mined) {
      for (const article of m.articles) addLead(m.fullName, article);
    }
  }

  const journalists = [...byAuthor.values()]
    .sort((a, b) => b.articles.length - a.articles.length)
    .slice(0, 50);

  return {
    publicationName: publicationName ?? undefined,
    domain,
    recentArticles: recentArticles.slice(0, 20),
    journalists,
  };
}

/**
 * Feed byline → individual person names. Handles wrappers ("By Jane Doe",
 * "jane@site.com (Jane Doe)") and multi-author strings ("A and B", "A, B").
 */
function authorsFromByline(raw?: string): string[] {
  if (!raw) return [];
  let a = raw.trim();
  const paren = a.match(/\(([^)]+)\)/);
  if (paren && /[a-z]/i.test(paren[1])) a = paren[1];
  return splitByline(a).filter(isLikelyPersonName);
}
