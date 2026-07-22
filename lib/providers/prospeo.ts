import type { DataProvider, EnrichResult, LookupInput } from "./types";

/**
 * Prospeo provider (BYO-account, per SPEC §4). A second real email-finder
 * behind the same DataProvider interface as Hunter, so the Contact
 * Intelligence waterfall can fall through Hunter → Prospeo before giving up.
 *
 * Endpoints:
 *   - GET  /account-information — cheap auth/credits check (no spend)
 *   - POST /enrich-person       — resolve an email from name + company
 *
 * Auth is the `X-KEY` header. Enrichment spends the user's own Prospeo
 * credits. Prospeo does discovery differently (no domain-listing on the
 * finder), so it stays enrichment-only — `supportsDiscovery` is unset.
 */
export const prospeo: DataProvider = {
  partner: "PROSPEO",
  label: "Prospeo",

  supports(input: LookupInput) {
    const hasCompany = Boolean(input.domain || input.outlet || input.email);
    const hasName = Boolean(
      input.fullName || (input.firstName && input.lastName),
    );
    return hasCompany && hasName;
  },

  async authenticate(apiKey: string) {
    const res = await fetch("https://api.prospeo.io/account-information", {
      method: "GET",
      headers: { "X-KEY": apiKey, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 400 || res.status === 401) {
      return { ok: false, error: "Prospeo rejected the API key." };
    }
    if (!res.ok) {
      return { ok: false, error: `Prospeo returned HTTP ${res.status}.` };
    }
    return { ok: true };
  },

  async enrich(apiKey: string, input: LookupInput): Promise<EnrichResult> {
    const { first, last } = names(input);
    if (!first || !last) {
      throw new Error("Prospeo needs a first and last name.");
    }
    const companyWebsite =
      input.domain ?? (input.email ? input.email.split("@")[1] : undefined);
    if (!companyWebsite && !input.outlet) {
      throw new Error("Prospeo needs a company domain or name.");
    }

    const res = await fetch("https://api.prospeo.io/enrich-person", {
      method: "POST",
      headers: { "X-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        data: {
          first_name: first,
          last_name: last,
          company_website: companyWebsite,
          company_name: input.outlet,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Prospeo HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
      );
    }
    const json = (await res.json()) as ProspeoEnrichResponse;

    const fields: EnrichResult["fields"] = [];
    const email = json.person?.email?.email;
    const status = json.person?.email?.status;
    if (email) {
      fields.push({ key: "email", value: email });
      // Map Prospeo's VERIFIED/UNVERIFIED to a numeric confidence so it
      // slots into the same "confidence" field the drawer already renders.
      fields.push({
        key: "confidence",
        value: status === "VERIFIED" ? "95" : "50",
      });
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
    return { first: parts[0], last: undefined };
  }
  return {};
}

type ProspeoEnrichResponse = {
  error?: boolean;
  free_enrichment?: boolean;
  person?: {
    email?: {
      status?: "VERIFIED" | "UNVERIFIED";
      revealed?: boolean;
      email?: string;
      verification_method?: string;
    };
  };
};
