import { resolveMx } from "node:dns/promises";
import type { EmailVerifyStatus } from "@prisma/client";
import { getSourceCache, putSourceCache } from "./cache";

/**
 * Free email verification: syntax + MX-record + role-account heuristics.
 * No paid verifier and no SMTP handshake (many hosts block it and it hurts
 * sender reputation). This gets us to "the domain can receive mail and the
 * address is well-formed" cheaply; a paid verifier can later upgrade a
 * GUESSED/UNKNOWN result to VALID behind the same EmailVerifyStatus enum.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_LOCALPARTS = new Set([
  "info",
  "press",
  "media",
  "pr",
  "editor",
  "editorial",
  "news",
  "tips",
  "contact",
  "hello",
  "admin",
  "support",
  "sales",
  "marketing",
  "newsroom",
]);

const MX_TTL_MS = 7 * 24 * 60 * 60 * 1000; // domains rarely change MX

export function isValidSyntax(email: string): boolean {
  return EMAIL_RE.test(email);
}

export function isRoleAccount(email: string): boolean {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  return ROLE_LOCALPARTS.has(local);
}

/** MX lookup, cached globally (public DNS data) so we resolve each host once. */
export async function domainHasMx(domain: string): Promise<boolean> {
  const key = `mx:${domain.toLowerCase()}`;
  const cached = await getSourceCache<{ hasMx: boolean }>(key);
  if (cached) return cached.hasMx;

  let hasMx = false;
  try {
    const records = await resolveMx(domain);
    hasMx = Array.isArray(records) && records.length > 0;
  } catch {
    hasMx = false;
  }
  await putSourceCache(key, "mx", { hasMx }, MX_TTL_MS);
  return hasMx;
}

/**
 * Classify an email with the free heuristics. `guessed` marks addresses we
 * synthesized via permutation (never observed), which cap out at GUESSED
 * even when the domain is mail-capable — we can't claim a real mailbox.
 */
export async function verifyEmailHeuristic(
  email: string,
  opts: { guessed?: boolean } = {},
): Promise<{ status: EmailVerifyStatus; confidence: number }> {
  if (!isValidSyntax(email)) {
    return { status: "INVALID", confidence: 0 };
  }
  const domain = email.split("@")[1];
  const hasMx = await domainHasMx(domain);
  if (!hasMx) {
    return { status: "INVALID", confidence: 10 };
  }
  if (isRoleAccount(email)) {
    // Role inboxes almost always accept mail but aren't a specific person.
    return { status: "ACCEPT_ALL", confidence: 55 };
  }
  if (opts.guessed) {
    return { status: "GUESSED", confidence: 45 };
  }
  return { status: "UNKNOWN", confidence: 65 };
}

/**
 * Generate likely email permutations for a person at a domain, ordered by
 * how common the pattern is. Used before any paid lookup — a verified
 * permutation is free.
 */
export function emailPermutations(
  firstName: string,
  lastName: string,
  domain: string,
): string[] {
  const f = firstName.trim().toLowerCase().replace(/[^a-z]/g, "");
  const l = lastName.trim().toLowerCase().replace(/[^a-z]/g, "");
  const d = domain.trim().toLowerCase().replace(/^www\./, "");
  if (!d) return [];
  const fi = f.slice(0, 1);
  const li = l.slice(0, 1);

  const locals = new Set<string>();
  if (f && l) {
    locals.add(`${f}.${l}`);
    locals.add(`${f}${l}`);
    locals.add(`${fi}${l}`);
    locals.add(`${f}${li}`);
    locals.add(`${fi}.${l}`);
    locals.add(`${f}_${l}`);
    locals.add(`${l}.${f}`);
    locals.add(`${l}${f}`);
  }
  if (f) locals.add(f);
  if (l) locals.add(l);

  return [...locals].filter(Boolean).map((local) => `${local}@${d}`);
}
