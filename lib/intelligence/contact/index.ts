import { db } from "@/lib/db";
import {
  getEmailDiscovery,
  putEmailDiscovery,
  normalizeDomain,
} from "../cache";
import { emailPermutations, verifyEmailHeuristic, domainHasMx } from "../verify";
import type {
  ContactIntel,
  EmailCandidate,
  PersonQuery,
} from "../types";

/**
 * A paid enrichment step, injected by the action layer so decrypted BYO
 * credentials never enter this module. Ordered cheapest → most expensive by
 * the caller (Hunter, then Apollo, then Prospeo/Dropcontact/PDL). Each
 * returns a candidate or null if it can't resolve the person.
 */
export type PaidResolver = {
  run: (person: PersonQuery) => Promise<EmailCandidate | null>;
};

export type ContactContext = {
  accountId: string;
  /** Paid resolvers, in preference order. Empty = free tiers only. */
  paidResolvers?: PaidResolver[];
};

/**
 * Contact Intelligence waterfall — the ONLY tier that may spend paid
 * credits, and only as a last resort:
 *
 *   1. Own database        (free)  — a Contact we already have an email for.
 *   2. Per-account cache   (free)  — a prior discovery for this account.
 *   3. Email permutation   (free)  — synthesize + heuristically verify.
 *   4. Paid providers      (paid)  — Hunter → Apollo → … only if still unresolved.
 *
 * Every resolved value is cached per-account so the next lookup short-circuits.
 */
export async function resolveContactEmail(
  person: PersonQuery,
  ctx: ContactContext,
): Promise<ContactIntel> {
  const domain = person.domain ? normalizeDomain(person.domain) : undefined;

  // 1. Own database — do we already know this person's email?
  const dbHit = await db.contact.findFirst({
    where: {
      name: { equals: person.fullName, mode: "insensitive" },
      email: { not: null },
    },
    select: { email: true, phone: true },
  });
  if (dbHit?.email && (!domain || dbHit.email.toLowerCase().endsWith(`@${domain}`))) {
    return {
      email: dbHit.email,
      emailStatus: "UNKNOWN",
      emailSource: "DATABASE",
      phone: dbHit.phone ?? undefined,
    };
  }

  // 2. Per-account cache.
  if (domain) {
    const cached = await getEmailDiscovery(ctx.accountId, person.fullName, domain);
    if (cached?.email) {
      return {
        email: cached.email,
        emailStatus: cached.status,
        emailSource: cached.source,
        confidence: cached.confidence ?? undefined,
        phone: cached.phone ?? undefined,
      };
    }
  }

  // 3. Free permutation + heuristic verification.
  let free: EmailCandidate | null = null;
  if (domain) {
    const { first, last } = splitName(person);
    if (first && last && (await domainHasMx(domain))) {
      const [top] = emailPermutations(first, last, domain);
      if (top) {
        const { status, confidence } = await verifyEmailHeuristic(top, {
          guessed: true,
        });
        free = { email: top, status, source: "PERMUTATION", confidence };
      }
    }
  }

  // 4. Paid providers — only reached because we still lack a confirmed email.
  let best: EmailCandidate | null = free;
  for (const resolver of ctx.paidResolvers ?? []) {
    try {
      const candidate = await resolver.run(person);
      if (candidate?.email) {
        best = candidate;
        break; // first paid hit wins; stop spending.
      }
    } catch {
      // A provider failure shouldn't sink the whole lookup — fall through
      // to the next resolver (or the free guess).
    }
  }

  if (!best?.email) {
    return {};
  }

  // Cache the winner per-account so repeats are free.
  if (domain) {
    await putEmailDiscovery(ctx.accountId, person.fullName, domain, {
      email: best.email,
      status: best.status,
      source: best.source,
      confidence: best.confidence ?? null,
      verifiedAt:
        best.status === "VALID" || best.source === "PERMUTATION"
          ? new Date()
          : null,
    });
  }

  return {
    email: best.email,
    emailStatus: best.status,
    emailSource: best.source,
    confidence: best.confidence,
  };
}

function splitName(person: PersonQuery): {
  first?: string;
  last?: string;
} {
  if (person.firstName || person.lastName) {
    return { first: person.firstName, last: person.lastName };
  }
  const parts = person.fullName.trim().split(/\s+/);
  if (parts.length < 2) return { first: parts[0], last: undefined };
  return { first: parts[0], last: parts[parts.length - 1] };
}
