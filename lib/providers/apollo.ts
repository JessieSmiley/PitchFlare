import type { DataProvider, EnrichResult, LookupInput } from "./types";

/**
 * Apollo provider (BYO-account) — people enrichment via /people/match.
 *
 * Apollo's defining quirk: unless the caller's plan has the email unlocked,
 * the response carries the placeholder `email_not_unlocked@domain.com`
 * instead of a real address. We detect that and treat it as "no email"
 * rather than writing a junk value onto the contact — that's the whole
 * point of wiring Apollo carefully.
 *
 * Endpoints (auth via `x-api-key`):
 *   - GET  /api/v1/auth/health     — cheap key validation
 *   - POST /api/v1/people/match    — enrich one person
 *
 * Enrichment spends the user's own Apollo credits.
 */
const LOCKED_EMAIL_RE = /email_not_unlocked|not_unlocked|email_hidden/i;

export const apollo: DataProvider = {
  partner: "APOLLO",
  label: "Apollo",

  supports(input: LookupInput) {
    const hasCompany = Boolean(input.domain || input.outlet || input.email);
    const hasName = Boolean(
      input.fullName || (input.firstName && input.lastName),
    );
    return hasCompany && hasName;
  },

  async authenticate(apiKey: string) {
    const res = await fetch("https://api.apollo.io/api/v1/auth/health", {
      method: "GET",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "Apollo rejected the API key." };
    }
    if (!res.ok) {
      return { ok: false, error: `Apollo returned HTTP ${res.status}.` };
    }
    return { ok: true };
  },

  async enrich(apiKey: string, input: LookupInput): Promise<EnrichResult> {
    const { first, last } = names(input);
    const domain =
      input.domain ?? (input.email ? input.email.split("@")[1] : undefined);

    const res = await fetch("https://api.apollo.io/api/v1/people/match", {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: first,
        last_name: last,
        name: !first && !last ? input.fullName : undefined,
        organization_name: input.outlet,
        domain,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Apollo HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
      );
    }
    const json = (await res.json()) as ApolloMatchResponse;
    const person = json.person;

    const fields: EnrichResult["fields"] = [];
    const email = person?.email;
    // Only accept a real, unlocked address.
    if (email && !LOCKED_EMAIL_RE.test(email)) {
      fields.push({ key: "email", value: email });
      fields.push({
        key: "confidence",
        value: person?.email_status === "verified" ? "90" : "55",
      });
    }
    if (person?.title) fields.push({ key: "title", value: person.title });
    if (person?.linkedin_url) {
      fields.push({ key: "linkedinUrl", value: person.linkedin_url });
    }
    if (person?.organization?.name) {
      fields.push({ key: "outletName", value: person.organization.name });
    }
    return { fields, raw: json };
  },
};

function names(input: LookupInput): { first?: string; last?: string } {
  if (input.firstName || input.lastName) {
    return { first: input.firstName, last: input.lastName };
  }
  if (input.fullName) {
    const parts = input.fullName.trim().split(/\s+/);
    if (parts.length >= 2)
      return { first: parts[0], last: parts[parts.length - 1] };
  }
  return {};
}

type ApolloMatchResponse = {
  person?: {
    email?: string;
    email_status?: string;
    title?: string;
    linkedin_url?: string;
    organization?: { name?: string };
  };
};
