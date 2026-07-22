import { db } from "@/lib/db";
import type {
  CompanyIntel,
  FundingFact,
  LinkRef,
  PersonRef,
} from "./types";
import type { EmailSource, EmailVerifyStatus } from "@prisma/client";

/**
 * Cache layer for the intelligence services. Two scopes, deliberately:
 *
 *   • GLOBAL (cross-tenant): CompanyProfile + SourceCache. These hold only
 *     PUBLIC data from free Tier-1 sources, so crawling "OpenAI" once and
 *     serving the result to every account is safe and is where the biggest
 *     savings come from.
 *
 *   • PER-ACCOUNT: EmailDiscovery. Paid contact data (or guesses that could
 *     later be verified with paid credits) is scoped to the account that
 *     produced it, because BYO partner credits belong to that account.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Normalize any URL/host-ish string down to a bare lowercase host. */
export function normalizeDomain(input: string): string {
  let s = input.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "");
  s = s.split("/")[0].split("?")[0].split("#")[0];
  return s;
}

/** Stable identity for a person within a domain (for the email cache). */
export function personKey(fullName: string): string {
  return fullName.trim().toLowerCase().replace(/\s+/g, " ");
}

// ---------------------------------------------------------------------------
// CompanyProfile (global)
// ---------------------------------------------------------------------------

export async function getCompanyProfile(
  domain: string,
  maxAgeDays = 30,
): Promise<CompanyIntel | null> {
  const row = await db.companyProfile.findUnique({
    where: { domain: normalizeDomain(domain) },
  });
  if (!row) return null;
  const age = Date.now() - row.refreshedAt.getTime();
  if (age > maxAgeDays * DAY_MS) return null;

  return {
    name: row.name,
    domain: row.domain,
    description: row.description ?? undefined,
    linkedinUrl: row.linkedinUrl ?? undefined,
    funding: (row.funding as FundingFact[] | null) ?? undefined,
    executives: (row.executives as PersonRef[] | null) ?? undefined,
    socials:
      (row.socials as Record<string, string> | null) ?? undefined,
    pressPages: row.pressPages,
    rssFeeds: row.rssFeeds,
    pressReleases: (row.pressReleases as LinkRef[] | null) ?? undefined,
    podcasts: (row.podcasts as LinkRef[] | null) ?? undefined,
    awards: (row.awards as LinkRef[] | null) ?? undefined,
    fromCache: true,
  };
}

export async function upsertCompanyProfile(
  intel: CompanyIntel & { domain: string },
): Promise<void> {
  const domain = normalizeDomain(intel.domain);
  const data = {
    name: intel.name,
    description: intel.description ?? null,
    linkedinUrl: intel.linkedinUrl ?? null,
    funding: intel.funding ?? undefined,
    executives: intel.executives ?? undefined,
    socials: intel.socials ?? undefined,
    pressPages: intel.pressPages ?? [],
    rssFeeds: intel.rssFeeds ?? [],
    pressReleases: intel.pressReleases ?? undefined,
    podcasts: intel.podcasts ?? undefined,
    awards: intel.awards ?? undefined,
    refreshedAt: new Date(),
  };
  await db.companyProfile.upsert({
    where: { domain },
    create: { domain, ...data },
    update: data,
  });
}

// ---------------------------------------------------------------------------
// SourceCache (global) — raw Tier-1 fetches keyed by "kind:identifier"
// ---------------------------------------------------------------------------

export async function getSourceCache<T>(key: string): Promise<T | null> {
  const row = await db.sourceCache.findUnique({ where: { key } });
  if (!row) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;
  return row.payload as T;
}

export async function putSourceCache(
  key: string,
  kind: string,
  payload: unknown,
  ttlMs?: number,
): Promise<void> {
  const expiresAt = ttlMs ? new Date(Date.now() + ttlMs) : null;
  // Prisma needs a concrete JSON value; undefined would drop the column.
  const json = (payload ?? null) as object;
  await db.sourceCache.upsert({
    where: { key },
    create: { key, kind, payload: json, expiresAt },
    update: { payload: json, kind, fetchedAt: new Date(), expiresAt },
  });
}

// ---------------------------------------------------------------------------
// EmailDiscovery (per-account)
// ---------------------------------------------------------------------------

export type EmailCacheRow = {
  email: string | null;
  status: EmailVerifyStatus;
  source: EmailSource;
  confidence: number | null;
  phone: string | null;
};

export async function getEmailDiscovery(
  accountId: string,
  fullName: string,
  domain: string,
): Promise<EmailCacheRow | null> {
  const row = await db.emailDiscovery.findUnique({
    where: {
      accountId_personKey_domain: {
        accountId,
        personKey: personKey(fullName),
        domain: normalizeDomain(domain),
      },
    },
    select: {
      email: true,
      status: true,
      source: true,
      confidence: true,
      phone: true,
    },
  });
  return row;
}

export async function putEmailDiscovery(
  accountId: string,
  fullName: string,
  domain: string,
  data: {
    email?: string | null;
    status: EmailVerifyStatus;
    source: EmailSource;
    confidence?: number | null;
    phone?: string | null;
    verifiedAt?: Date | null;
  },
): Promise<void> {
  const key = personKey(fullName);
  const dom = normalizeDomain(domain);
  const payload = {
    email: data.email ?? null,
    status: data.status,
    source: data.source,
    confidence: data.confidence ?? null,
    phone: data.phone ?? null,
    verifiedAt: data.verifiedAt ?? null,
  };
  await db.emailDiscovery.upsert({
    where: {
      accountId_personKey_domain: { accountId, personKey: key, domain: dom },
    },
    create: { accountId, personKey: key, domain: dom, ...payload },
    update: payload,
  });
}
