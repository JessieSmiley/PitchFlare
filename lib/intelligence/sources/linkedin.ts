/**
 * Tier-1 free source: derive a company's LinkedIn URL. We only ever produce
 * a *company* page URL — from Schema.org sameAs when crawling found one, or a
 * slug guess from the company name. We never scrape personal LinkedIn
 * profiles (against LinkedIn's ToS and out of scope for the free tier).
 */

export function companyLinkedinUrl(
  name: string,
  crawledLinkedin?: string,
): string | undefined {
  if (crawledLinkedin) return crawledLinkedin;
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) return undefined;
  // A best-effort guess; callers treat it as unverified.
  return `https://www.linkedin.com/company/${slug}`;
}
