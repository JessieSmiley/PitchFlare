import type { DataProvider, EnrichResult, LookupInput } from "./types";

/**
 * Hunter.io provider.
 *
 * Two endpoints matter:
 *   - /v2/account       — cheap auth check
 *   - /v2/email-finder  — fill a missing email given (domain + name)
 *   - /v2/email-verifier — confirm an email resolves (optional)
 *
 * Each call takes `api_key` as a query param and returns JSON. Costs
 * count against the user's own Hunter plan — this is a BYO-account
 * integration per SPEC.md §4.
 */
export const hunter: DataProvider = {
  partner: "HUNTER",
  label: "Hunter.io",

  supports(input: LookupInput) {
    // Email-finder needs (domain + first/last) or (full_name + domain).
    const hasDomain = Boolean(input.domain || input.email);
    const hasName = Boolean(
      input.fullName || (input.firstName && input.lastName),
    );
    return hasDomain && hasName;
  },

  async authenticate(apiKey: string) {
    const url = `https://api.hunter.io/v2/account?api_key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "PitchFlare/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 401) {
      return { ok: false, error: "Hunter rejected the API key." };
    }
    if (!res.ok) {
      return { ok: false, error: `Hunter returned HTTP ${res.status}.` };
    }
    return { ok: true };
  },

  async enrich(apiKey: string, input: LookupInput): Promise<EnrichResult> {
    const domain =
      input.domain ?? (input.email ? input.email.split("@")[1] : undefined);
    if (!domain) throw new Error("Hunter needs a domain or an email.");

    const params = new URLSearchParams({
      api_key: apiKey,
      domain,
    });
    if (input.firstName) params.set("first_name", input.firstName);
    if (input.lastName) params.set("last_name", input.lastName);
    if (input.fullName && !input.firstName && !input.lastName) {
      params.set("full_name", input.fullName);
    }

    const url = `https://api.hunter.io/v2/email-finder?${params}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "PitchFlare/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Hunter HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
      );
    }
    const json = (await res.json()) as HunterFinderResponse;

    const fields: EnrichResult["fields"] = [];
    const d = json.data;
    if (d?.email) fields.push({ key: "email", value: d.email });
    if (d?.position) fields.push({ key: "title", value: d.position });
    if (d?.company) fields.push({ key: "outletName", value: d.company });
    if (d?.linkedin_url) fields.push({ key: "linkedinUrl", value: d.linkedin_url });
    if (d?.twitter) fields.push({ key: "twitterUrl", value: `https://twitter.com/${d.twitter.replace(/^@/, "")}` });
    if (d?.phone_number) fields.push({ key: "phone", value: d.phone_number });
    if (typeof d?.score === "number") {
      fields.push({ key: "confidence", value: String(d.score) });
    }

    return { fields, raw: json };
  },
};

type HunterFinderResponse = {
  data?: {
    email?: string;
    score?: number;
    position?: string;
    company?: string;
    linkedin_url?: string;
    twitter?: string;
    phone_number?: string;
  };
};
