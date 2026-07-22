import { hunter } from "@/lib/providers";
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

/** Stub — Apollo people/email API lands behind this same interface. */
export function apolloResolver(_apiKey: string): PaidResolver {
  return { run: async () => null };
}

/** Stub — Prospeo email-finder. */
export function prospeoResolver(_apiKey: string): PaidResolver {
  return { run: async () => null };
}

/** Stub — Dropcontact enrichment/verification. */
export function dropcontactResolver(_apiKey: string): PaidResolver {
  return { run: async () => null };
}

/** Stub — People Data Labs person enrichment. */
export function peopleDataLabsResolver(_apiKey: string): PaidResolver {
  return { run: async () => null };
}
