import type { IntegrationPartner } from "@prisma/client";

/**
 * Lookup inputs accepted by every provider. A caller passes whichever it
 * has; the provider uses what it can and returns empty-fielded rows for
 * the rest. Nothing here is required — the provider decides its own
 * minimum.
 */
export type LookupInput = {
  email?: string;
  domain?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  outlet?: string;
};

/**
 * Keys that come back from enrichment, aligned with the Contact profile
 * surface in PitchFlare. Providers pick whatever they can fill. Every
 * written ContactField row carries `source: DATA_PARTNER` and we never
 * overwrite USER_ADDED values.
 */
export type EnrichedField = {
  key:
    | "email"
    | "phone"
    | "title"
    | "outletName"
    | "linkedinUrl"
    | "twitterUrl"
    | "confidence"
    | string;
  value: string;
};

export type EnrichResult = {
  /** The fields we were able to populate. */
  fields: EnrichedField[];
  /** Optional provider-specific debug payload (never shown to users). */
  raw?: unknown;
};

export interface DataProvider {
  /** Stable identifier matching the IntegrationPartner enum. */
  partner: IntegrationPartner;
  /** Short human label used in the Integrations UI. */
  label: string;
  /**
   * Whether this provider can usefully enrich the given inputs. Prevents
   * pointless API calls that would just 400 on insufficient identifiers.
   */
  supports(input: LookupInput): boolean;
  /**
   * Verify the user's API key. Cheap GET against an account-info endpoint
   * is preferred — enrichment calls cost credits.
   */
  authenticate(apiKey: string): Promise<{ ok: boolean; error?: string }>;
  /**
   * Return enriched fields for the caller. Throws on network or auth
   * failure so the calling action can surface the error.
   */
  enrich(apiKey: string, input: LookupInput): Promise<EnrichResult>;
}
