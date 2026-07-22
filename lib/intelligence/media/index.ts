import { getCompanyIntel } from "../company";
import { fetchFeed } from "../sources/rss";
import { recentNews } from "../sources/news";
import type {
  JournalistLead,
  LinkRef,
  MediaIntel,
  MediaQuery,
} from "../types";

/**
 * Media Intelligence service (Tier-1, free, PUBLIC data). Surfaces the
 * publication, its recent articles, and the journalists writing for it —
 * the latter derived from RSS byline tags (<dc:creator>/<author>), the
 * free and ToS-clean way to map bylines to an outlet (no profile scraping).
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

  // Recent articles: prefer the outlet's own feeds, fall back to news.
  const feeds = company?.rssFeeds ?? [];
  const feedItems = (
    await Promise.all(feeds.slice(0, 3).map((f) => fetchFeed(f)))
  ).flat();

  const recentArticles: LinkRef[] = feedItems.length
    ? feedItems.map((i) => ({
        title: i.title,
        url: i.url,
        publishedAt: i.publishedAt,
      }))
    : await recentNews(publicationName ?? query.name ?? "", 10);

  // Aggregate bylines into journalist leads.
  const byAuthor = new Map<string, JournalistLead>();
  for (const item of feedItems) {
    const author = cleanAuthor(item.author);
    if (!author) continue;
    const existing = byAuthor.get(author.toLowerCase());
    const article: LinkRef = {
      title: item.title,
      url: item.url,
      publishedAt: item.publishedAt,
    };
    if (existing) {
      existing.articles.push(article);
    } else {
      byAuthor.set(author.toLowerCase(), {
        fullName: author,
        outletName: publicationName ?? undefined,
        articles: [article],
        beats: [],
      });
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

/** Feeds sometimes wrap authors ("By Jane Doe", "jane@site.com (Jane Doe)"). */
function cleanAuthor(raw?: string): string | null {
  if (!raw) return null;
  let a = raw.trim();
  const paren = a.match(/\(([^)]+)\)/);
  if (paren && /[a-z]/i.test(paren[1])) a = paren[1];
  a = a.replace(/^by\s+/i, "").replace(/\s+/g, " ").trim();
  // Reject obviously-non-name values (emails, empty, single tokens of noise).
  if (!a || a.includes("@") || a.length > 60) return null;
  if (!/[a-z]/i.test(a)) return null;
  return a;
}
