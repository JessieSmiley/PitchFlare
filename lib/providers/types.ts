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

/**
 * Discovery inputs. Unlike enrichment (which takes one known contact and
 * fills gaps), discovery takes a free-text query — usually an outlet or
 * company name typed into the Targets search bar — and returns a list of
 * *candidate* people who are not yet in the directory. `query` is what the
 * user typed; a provider maps it to whatever its search API needs (Hunter's
 * domain-search, for instance, accepts a `company` name directly). `domain`
 * lets a caller pin the lookup to an exact host when it has one.
 */
export type DiscoverInput = {
  query?: string;
  domain?: string;
  /** Optional bias toward a Hunter department (e.g. "communication"). */
  department?: string;
  /** Optional title keywords to bias press/editorial roles. */
  jobTitles?: string[];
  /** Max candidates to return. Providers clamp to their own ceiling. */
  limit?: number;
};

/**
 * A person surfaced by discovery, not yet persisted. Mirrors the fields a
 * Contact + its DATA_PARTNER ContactField rows would carry once saved, so
 * the "add" action can write them straight through. Only `fullName` is
 * guaranteed; everything else is best-effort from the provider.
 */
export type DiscoveredPerson = {
  fullName: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  title?: string;
  outletName?: string;
  domain?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  phone?: string;
  /** Provider confidence 0–100 where available. */
  confidence?: number;
  /**
   * Verification/provenance from the discovery waterfall. `emailStatus`
   * mirrors EmailVerifyStatus (VALID/ACCEPT_ALL/UNKNOWN/GUESSED/INVALID)
   * and `emailSource` mirrors EmailSource (DATABASE/CACHE/PERMUTATION/
   * HUNTER/…) so the UI can badge how an address was found and how sure we
   * are. Optional — direct provider discovery leaves them unset.
   */
  emailStatus?: string;
  emailSource?: string;
};

export type DiscoverResult = {
  /** Candidate people the query surfaced. May be empty. */
  people: DiscoveredPerson[];
  /** The outlet/company name the provider resolved, if any. */
  outletName?: string;
  /** The domain the provider resolved, if any. */
  domain?: string;
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
  /**
   * Whether this provider can search outward for new contacts (as opposed
   * to only enriching known ones). Providers without `discover` leave this
   * falsy and the Targets UI hides them from the search affordance.
   */
  supportsDiscovery?: boolean;
  /**
   * Search for candidate people matching the query. Optional — only
   * discovery-capable providers implement it. Throws on network or auth
   * failure so the calling action can surface the error.
   */
  discover?(apiKey: string, input: DiscoverInput): Promise<DiscoverResult>;
}
