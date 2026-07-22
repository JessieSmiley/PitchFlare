import type { EmailSource, EmailVerifyStatus } from "@prisma/client";

/**
 * Shared vocabulary for the three intelligence services. The product is
 * split so paid enrichment stays isolated to Contact Intelligence:
 *
 *   1. Media Intelligence   — journalists, publications, articles, beats,
 *                             editorial calendars. PUBLIC / free sources.
 *   2. Company Intelligence — funding, execs, hiring, press releases,
 *                             social, podcasts, awards. PUBLIC / free.
 *   3. Contact Intelligence — email, verification, phone, LinkedIn, PR
 *                             contact. The ONLY tier that may spend paid
 *                             enrichment credits, and only as a last resort.
 *
 * Everything flows through a cache-first waterfall (see waterfall.ts): own
 * DB → cache → free Tier-1 sources → AI extraction → email prediction →
 * heuristic verification → paid providers (Hunter, Apollo, …) → cache.
 */

export const TIER = {
  /** Free/near-free public sources. Always tried first. */
  FREE: 1,
  /** Paid enrichment. Only reached when the free waterfall comes up empty. */
  PAID: 2,
} as const;

// ---------------------------------------------------------------------------
// Company Intelligence
// ---------------------------------------------------------------------------

export type CompanyQuery = {
  /** Free-text name the user typed (e.g. "New York Times"). */
  name?: string;
  /** Exact host if the caller already has one (e.g. "nytimes.com"). */
  domain?: string;
};

export type FundingFact = { round?: string; amount?: string; date?: string };
export type PersonRef = { name: string; title?: string; url?: string };
export type LinkRef = { title: string; url: string; publishedAt?: string };

export type CompanyIntel = {
  name: string;
  domain?: string;
  description?: string;
  linkedinUrl?: string;
  funding?: FundingFact[];
  executives?: PersonRef[];
  socials?: Record<string, string>;
  pressPages?: string[];
  rssFeeds?: string[];
  pressReleases?: LinkRef[];
  podcasts?: LinkRef[];
  awards?: LinkRef[];
  /** Where the assembled profile came from — "cache" vs freshly crawled. */
  fromCache: boolean;
};

/** Client-safe slice of CompanyIntel for the discovery + company UI. */
export type CompanySummary = {
  name: string;
  domain?: string;
  description?: string;
  linkedinUrl?: string;
  socials?: Record<string, string>;
  funding?: FundingFact[];
  executives?: PersonRef[];
  awards?: LinkRef[];
  podcasts?: LinkRef[];
  pressReleases?: LinkRef[];
  pressPages?: string[];
};

// ---------------------------------------------------------------------------
// Media Intelligence
// ---------------------------------------------------------------------------

export type MediaQuery = {
  /** Outlet/publication name or company to find press around. */
  name?: string;
  domain?: string;
};

export type JournalistLead = {
  fullName: string;
  outletName?: string;
  title?: string;
  /** Article URLs that surfaced this byline. */
  articles: LinkRef[];
  beats: string[];
};

export type MediaIntel = {
  publicationName?: string;
  domain?: string;
  recentArticles: LinkRef[];
  journalists: JournalistLead[];
};

// ---------------------------------------------------------------------------
// Contact Intelligence (the only paid tier)
// ---------------------------------------------------------------------------

export type PersonQuery = {
  fullName: string;
  firstName?: string;
  lastName?: string;
  /** Domain to resolve the email against. */
  domain?: string;
  outletName?: string;
};

export type EmailCandidate = {
  email: string;
  status: EmailVerifyStatus;
  source: EmailSource;
  /** 0–100 where the provider or heuristic offers one. */
  confidence?: number;
};

export type ContactIntel = {
  email?: string;
  emailStatus?: EmailVerifyStatus;
  emailSource?: EmailSource;
  confidence?: number;
  phone?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  /** Generic press/PR inbox for the outlet (e.g. press@nytimes.com). */
  prContactEmail?: string;
};

// ---------------------------------------------------------------------------
// Free Tier-1 source adapter shape
// ---------------------------------------------------------------------------

export type CrawlResult = {
  domain: string;
  name?: string;
  description?: string;
  logoUrl?: string;
  linkedinUrl?: string;
  socials: Record<string, string>;
  executives: PersonRef[];
  pressPages: string[];
  rssFeeds: string[];
  /** Bounded plain-text sample of the homepage, for AI fact extraction. */
  textSample?: string;
};
