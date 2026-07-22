import type {
  DataProvider,
  DiscoverInput,
  DiscoverResult,
  DiscoveredPerson,
  EnrichResult,
  LookupInput,
} from "./types";

/**
 * Hunter.io provider.
 *
 * Endpoints that matter:
 *   - /v2/account       — cheap auth check
 *   - /v2/email-finder  — fill a missing email given (domain + name)
 *   - /v2/domain-search — discover people at a company/domain
 *   - /v2/email-verifier — confirm an email resolves (optional)
 *
 * Each call takes `api_key` as a query param and returns JSON. Costs
 * count against the user's own Hunter plan — this is a BYO-account
 * integration per SPEC.md §4.
 */
export const hunter: DataProvider = {
  partner: "HUNTER",
  label: "Hunter.io",
  supportsDiscovery: true,

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

  async discover(
    apiKey: string,
    input: DiscoverInput,
  ): Promise<DiscoverResult> {
    // domain-search wants either a `domain` or a `company` name. The Targets
    // search bar gives us free text (e.g. "New York Times"), which Hunter
    // resolves via `company`; a caller with an exact host passes `domain`.
    const params = new URLSearchParams({ api_key: apiKey });
    if (input.domain) {
      params.set("domain", input.domain);
    } else if (input.query) {
      params.set("company", input.query);
    } else {
      throw new Error("Hunter discovery needs a company name or domain.");
    }

    // Bias toward press/editorial people. Hunter accepts these as filters;
    // callers can override the default department via input.
    if (input.department) params.set("department", input.department);
    if (input.jobTitles?.length) {
      params.set("job_titles", input.jobTitles.join(","));
    }
    // Clamp to Hunter's 100 ceiling and a sane default for an interactive
    // search that spends the user's credits.
    const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
    params.set("limit", String(limit));

    const url = `https://api.hunter.io/v2/domain-search?${params}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "PitchFlare/1.0" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Hunter HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
      );
    }
    const json = (await res.json()) as HunterDomainSearchResponse;

    const d = json.data;
    const outletName = d?.organization ?? undefined;
    const domain = d?.domain ?? undefined;

    const people: DiscoveredPerson[] = (d?.emails ?? [])
      .map((e): DiscoveredPerson | null => {
        const first = e.first_name?.trim() || undefined;
        const last = e.last_name?.trim() || undefined;
        const fullName =
          [first, last].filter(Boolean).join(" ").trim() ||
          // domain-search rows are keyed by email; if a name is missing we
          // fall back to the local-part so the candidate is still selectable.
          (e.value ? e.value.split("@")[0] : "");
        if (!fullName) return null;
        return {
          fullName,
          firstName: first,
          lastName: last,
          email: e.value || undefined,
          title: e.position || undefined,
          outletName,
          domain,
          linkedinUrl: e.linkedin || undefined,
          twitterUrl: e.twitter
            ? `https://twitter.com/${e.twitter.replace(/^@/, "")}`
            : undefined,
          phone: e.phone_number || undefined,
          confidence:
            typeof e.confidence === "number" ? e.confidence : undefined,
        };
      })
      .filter((p): p is DiscoveredPerson => p !== null);

    return { people, outletName, domain, raw: json };
  },
};

type HunterDomainSearchResponse = {
  data?: {
    domain?: string;
    organization?: string;
    emails?: Array<{
      value?: string;
      type?: string;
      confidence?: number;
      first_name?: string;
      last_name?: string;
      position?: string;
      seniority?: string;
      department?: string;
      linkedin?: string;
      twitter?: string;
      phone_number?: string;
    }>;
  };
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
