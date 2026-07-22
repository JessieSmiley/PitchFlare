import type {
  DataProvider,
  EnrichJob,
  EnrichPoll,
  EnrichResult,
  LookupInput,
} from "./types";
import { runProviderEnrich } from "./enrich";

/**
 * Dropcontact provider (BYO-account) — the first ASYNC enrichment provider.
 * Dropcontact's batch endpoint doesn't answer inline: you POST contacts and
 * get a `request_id`, then poll until the job finishes. This provider
 * implements `submitEnrich`/`pollEnrich`, and `enrich` just wraps them via
 * the shared orchestrator so every existing caller keeps working unchanged.
 *
 * Endpoints (auth via `X-Access-Token`):
 *   - POST /v1/enrich/all           — submit; returns { request_id }
 *   - GET  /v1/enrich/all/{id}      — poll; success=false means "not ready"
 *   - POST /v1/enrich/all {data:[{}]} — validates the key for free
 *
 * Enrichment spends the user's own Dropcontact credits.
 */
export const dropcontact: DataProvider = {
  partner: "DROPCONTACT",
  label: "Dropcontact",
  enrichIsAsync: true,

  supports(input: LookupInput) {
    const hasCompany = Boolean(input.domain || input.outlet || input.email);
    const hasName = Boolean(
      input.fullName || (input.firstName && input.lastName),
    );
    return hasCompany && hasName;
  },

  async authenticate(apiKey: string) {
    // Empty data object returns credits_left without consuming any.
    const res = await fetch("https://api.dropcontact.com/v1/enrich/all", {
      method: "POST",
      headers: { "X-Access-Token": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ data: [{}] }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "Dropcontact rejected the API key." };
    }
    if (!res.ok) {
      return { ok: false, error: `Dropcontact returned HTTP ${res.status}.` };
    }
    return { ok: true };
  },

  async submitEnrich(apiKey: string, input: LookupInput): Promise<EnrichJob> {
    const { first, last } = names(input);
    const company =
      input.domain ??
      (input.email ? input.email.split("@")[1] : undefined) ??
      input.outlet;
    const res = await fetch("https://api.dropcontact.com/v1/enrich/all", {
      method: "POST",
      headers: { "X-Access-Token": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [
          {
            first_name: first,
            last_name: last,
            full_name: !first && !last ? input.fullName : undefined,
            company,
          },
        ],
        language: "en",
        siren: false,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Dropcontact HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
      );
    }
    const json = (await res.json()) as DropcontactSubmitResponse;
    if (!json.request_id) {
      throw new Error("Dropcontact did not return a request id.");
    }
    return { jobId: json.request_id };
  },

  async pollEnrich(apiKey: string, jobId: string): Promise<EnrichPoll> {
    const res = await fetch(
      `https://api.dropcontact.com/v1/enrich/all/${encodeURIComponent(jobId)}`,
      {
        method: "GET",
        headers: {
          "X-Access-Token": apiKey,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!res.ok) {
      return { status: "error", error: `Dropcontact HTTP ${res.status}` };
    }
    const json = (await res.json()) as DropcontactPollResponse;
    // success=false with data still missing means "not ready yet".
    if (!json.success || !json.data) {
      return { status: "pending" };
    }

    const row = json.data[0];
    const fields: EnrichResult["fields"] = [];
    const best = row?.email?.[0];
    if (best?.email) {
      fields.push({ key: "email", value: best.email });
      // "nominative@pro" is a named professional mailbox — high confidence.
      const q = best.qualification ?? "";
      fields.push({
        key: "confidence",
        value: /nominative/i.test(q) ? "90" : "60",
      });
    }
    if (row?.phone) fields.push({ key: "phone", value: row.phone });
    return { status: "done", result: { fields, raw: json } };
  },

  async enrich(apiKey: string, input: LookupInput): Promise<EnrichResult> {
    // Delegate to the shared submit+poll orchestrator.
    return runProviderEnrich(dropcontact, apiKey, input);
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

type DropcontactSubmitResponse = {
  success?: boolean;
  request_id?: string;
  credits_left?: number;
};

type DropcontactPollResponse = {
  success?: boolean;
  reason?: string;
  data?: Array<{
    email?: Array<{ email?: string; qualification?: string }>;
    phone?: string;
  }>;
};
