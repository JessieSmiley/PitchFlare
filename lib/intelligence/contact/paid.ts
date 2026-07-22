import { hunter, apollo, prospeo, dropcontact } from "@/lib/providers";
import type { PaidResolver } from "./index";
import type { EmailCandidate, PersonQuery } from "../types";

/**
 * Builders that turn a decrypted BYO API key into a PaidResolver for the
 * Contact Intelligence waterfall. Only Hunter is live; Apollo, Prospeo,
 * Dropcontact, and People Data Labs are stubbed behind the same interface
 * so they slot in without touching the waterfall. Ordering (cheapest →
 * most expensive) is the caller's responsibility.
 */

export function hunterResolver(apiKey: string): PaidResolver {
  return {
    async run(person: PersonQuery): Promise<EmailCandidate | null> {
      const input = {
        domain: person.domain,
        fullName: person.fullName,
        firstName: person.firstName,
        lastName: person.lastName,
        outlet: person.outletName,
      };
      if (!hunter.supports(input)) return null;
      const result = await hunter.enrich(apiKey, input);
      const email = result.fields.find((f) => f.key === "email")?.value;
      if (!email) return null;
      const scoreStr = result.fields.find((f) => f.key === "confidence")?.value;
      const confidence = scoreStr ? Number(scoreStr) : undefined;
      return {
        email,
        source: "HUNTER",
        status:
          typeof confidence === "number" && confidence >= 80
            ? "VALID"
            : "UNKNOWN",
        confidence,
      };
    },
  };
}

/**
 * Apollo people-match enrichment (live). The provider already drops locked
 * `email_not_unlocked@…` placeholders, so a null email here means Apollo
 * genuinely couldn't resolve (or unlock) an address for this person.
 */
export function apolloResolver(apiKey: string): PaidResolver {
  return {
    async run(person: PersonQuery): Promise<EmailCandidate | null> {
      const input = {
        domain: person.domain,
        fullName: person.fullName,
        firstName: person.firstName,
        lastName: person.lastName,
        outlet: person.outletName,
      };
      if (!apollo.supports(input)) return null;
      const result = await apollo.enrich(apiKey, input);
      const email = result.fields.find((f) => f.key === "email")?.value;
      if (!email) return null;
      const scoreStr = result.fields.find((f) => f.key === "confidence")?.value;
      const confidence = scoreStr ? Number(scoreStr) : undefined;
      return {
        email,
        source: "APOLLO",
        status:
          typeof confidence === "number" && confidence >= 90
            ? "VALID"
            : "UNKNOWN",
        confidence,
      };
    },
  };
}

/** Prospeo enrich-person email finder (live). */
export function prospeoResolver(apiKey: string): PaidResolver {
  return {
    async run(person: PersonQuery): Promise<EmailCandidate | null> {
      const input = {
        domain: person.domain,
        fullName: person.fullName,
        firstName: person.firstName,
        lastName: person.lastName,
        outlet: person.outletName,
      };
      if (!prospeo.supports(input)) return null;
      const result = await prospeo.enrich(apiKey, input);
      const email = result.fields.find((f) => f.key === "email")?.value;
      if (!email) return null;
      const scoreStr = result.fields.find((f) => f.key === "confidence")?.value;
      const confidence = scoreStr ? Number(scoreStr) : undefined;
      return {
        email,
        source: "PROSPEO",
        status:
          typeof confidence === "number" && confidence >= 90
            ? "VALID"
            : "UNKNOWN",
        confidence,
      };
    },
  };
}

/**
 * Dropcontact enrichment (live, async). Note: Dropcontact submits a job and
 * polls, so a single lookup can take several seconds — fine for the
 * per-contact drawer, but callers that resolve many people in a loop (bulk
 * discovery) should leave it out of the chain to avoid stalling the list.
 */
export function dropcontactResolver(apiKey: string): PaidResolver {
  return {
    async run(person: PersonQuery): Promise<EmailCandidate | null> {
      const input = {
        domain: person.domain,
        fullName: person.fullName,
        firstName: person.firstName,
        lastName: person.lastName,
        outlet: person.outletName,
      };
      if (!dropcontact.supports(input)) return null;
      const result = await dropcontact.enrich(apiKey, input);
      const email = result.fields.find((f) => f.key === "email")?.value;
      if (!email) return null;
      const scoreStr = result.fields.find((f) => f.key === "confidence")?.value;
      const confidence = scoreStr ? Number(scoreStr) : undefined;
      return {
        email,
        source: "DROPCONTACT",
        status:
          typeof confidence === "number" && confidence >= 90
            ? "VALID"
            : "UNKNOWN",
        confidence,
      };
    },
  };
}

/** Stub — People Data Labs person enrichment. */
export function peopleDataLabsResolver(_apiKey: string): PaidResolver {
  return { run: async () => null };
}
