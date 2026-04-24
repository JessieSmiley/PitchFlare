import type { IntegrationPartner } from "@prisma/client";
import type { DataProvider } from "./types";
import { hunter } from "./hunter";
import { apollo } from "./apollo";
import { podchaser } from "./podchaser";
import { sparktoro } from "./sparktoro";

/**
 * Registry of known providers. The Integrations UI iterates this and the
 * enrichment action resolves a provider by `IntegrationPartner` enum.
 * Only four partners are surfaced — WIRE and RESEND_DOMAIN (also in the
 * enum) are internal integration kinds that the Integrations page
 * doesn't manage.
 */
export const PROVIDERS: DataProvider[] = [hunter, apollo, podchaser, sparktoro];

export function providerFor(partner: IntegrationPartner): DataProvider | null {
  return PROVIDERS.find((p) => p.partner === partner) ?? null;
}

export { hunter, apollo, podchaser, sparktoro };
export type { DataProvider, LookupInput, EnrichResult } from "./types";
