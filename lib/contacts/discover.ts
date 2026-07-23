"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import { decryptSecret } from "@/lib/crypto";
import { hunter } from "@/lib/providers";
import { discoverContactsWaterfall } from "@/lib/intelligence/waterfall";
import {
  hunterResolver,
  apolloResolver,
  prospeoResolver,
} from "@/lib/intelligence/contact/paid";
import type { PaidResolver } from "@/lib/intelligence/contact";
import type { CompanySummary } from "@/lib/intelligence/types";
import type { DiscoveredPerson } from "@/lib/providers/types";

type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

const DiscoverInputSchema = z.object({
  query: z.string().trim().min(2).max(120),
  limit: z.number().int().min(1).max(100).optional(),
});

/**
 * Discover candidate contacts for a company/outlet the user typed into the
 * Targets search bar. Runs the cache-first waterfall (Media Intelligence +
 * free email resolution) and only backfills with a connected paid provider
 * (Hunter) when the free path comes up short. Read-only: nothing is
 * persisted until the user picks candidates via addDiscoveredContacts.
 *
 * Works with NO connected partner (free tiers alone). If Hunter is
 * connected, its key powers both email resolution and the paid discovery
 * backfill; a provider failure is swallowed by the waterfall so the free
 * results still return, but we record it on the Integration for Settings.
 */
export async function discoverContacts(
  input: z.input<typeof DiscoverInputSchema>,
): Promise<
  ActionResult<{
    people: DiscoveredPerson[];
    outletName?: string;
    company: CompanySummary | null;
    usedPaidDiscovery: boolean;
  }>
> {
  const parsed = DiscoverInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const tenant = await requireTenant();
  const accountId = tenant.account.id;

  // Wire the paid tier from whatever email-capable partners are connected.
  // Everything else runs on free sources + cache. Resolvers are ordered
  // in preference order (Hunter → Apollo → Prospeo) so the waterfall stops
  // at the first hit. Dropcontact is intentionally excluded here — its
  // submit+poll latency belongs on the single-contact drawer path, not a
  // per-person discovery loop.
  const paidIntegrations = await db.integration.findMany({
    where: {
      accountId,
      partner: { in: ["HUNTER", "APOLLO", "PROSPEO"] },
      status: "CONNECTED",
    },
  });
  const byPartner = new Map(paidIntegrations.map((i) => [i.partner, i]));

  const paidResolvers: PaidResolver[] = [];
  let paidDiscovery:
    | ((q: {
        name?: string;
        domain?: string;
      }) => Promise<{ people: DiscoveredPerson[]; domain?: string }>)
    | undefined;

  const hunterIntegration = byPartner.get("HUNTER");
  if (hunterIntegration) {
    const key = decryptSecret(hunterIntegration.encryptedCredentials);
    paidResolvers.push(hunterResolver(key));
    // Hunter is the only connected partner that can also *discover* people.
    paidDiscovery = async (q) => {
      try {
        const res = await hunter.discover!(key, {
          query: q.name,
          domain: q.domain,
          department: "communication",
          limit: parsed.data.limit ?? 25,
        });
        await db.integration.update({
          where: { id: hunterIntegration.id },
          data: { lastSyncAt: new Date(), lastError: null, status: "CONNECTED" },
        });
        return { people: res.people, domain: res.domain };
      } catch (err) {
        await db.integration.update({
          where: { id: hunterIntegration.id },
          data: {
            status: "ERROR",
            lastError: err instanceof Error ? err.message : "discovery failed",
          },
        });
        return { people: [] };
      }
    };
  }

  const apolloIntegration = byPartner.get("APOLLO");
  if (apolloIntegration) {
    const key = decryptSecret(apolloIntegration.encryptedCredentials);
    paidResolvers.push(apolloResolver(key));
  }

  const prospeoIntegration = byPartner.get("PROSPEO");
  if (prospeoIntegration) {
    const key = decryptSecret(prospeoIntegration.encryptedCredentials);
    paidResolvers.push(prospeoResolver(key));
  }

  const outcome = await discoverContactsWaterfall(
    { name: parsed.data.query },
    { accountId, paidResolvers, paidDiscovery },
  );

  return {
    ok: true,
    people: outcome.people,
    outletName: outcome.outletName,
    company: outcome.company,
    usedPaidDiscovery: outcome.usedPaidDiscovery,
  };
}

const PersonSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  firstName: z.string().trim().max(120).optional(),
  lastName: z.string().trim().max(120).optional(),
  email: z.string().trim().email().optional(),
  title: z.string().trim().max(200).optional(),
  outletName: z.string().trim().max(200).optional(),
  domain: z.string().trim().max(255).optional(),
  linkedinUrl: z.string().trim().max(500).optional(),
  twitterUrl: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(60).optional(),
  confidence: z.number().min(0).max(100).optional(),
});

const AddDiscoveredInput = z.object({
  people: z.array(PersonSchema).min(1).max(50),
  kind: z
    .enum(["JOURNALIST", "PODCASTER", "INFLUENCER", "ANALYST", "OUTLET"])
    .default("JOURNALIST"),
});

/**
 * Persist chosen discovery candidates as Contacts. Provider-supplied
 * attributes land as ContactField rows tagged DATA_PARTNER (same
 * provenance model as enrichment), the email is promoted to the Contact
 * column, and the outlet is attached by domain when we have one.
 *
 * Candidates whose email already exists on a Contact are skipped so
 * re-running the same search never creates duplicates.
 */
export async function addDiscoveredContacts(
  input: z.input<typeof AddDiscoveredInput>,
): Promise<ActionResult<{ added: number; skipped: number; contactIds: string[] }>> {
  const parsed = AddDiscoveredInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const tenant = await requireTenant();
  if (!tenant.brand) return { ok: false, error: "No brand selected." };
  const brandId = tenant.brand.id;

  // Dedup against existing contacts by email in one query up front. Keep the
  // existing contact id too so the caller can still add an already-known
  // person to a list (skipped for creation ≠ excluded from the selection).
  const emails = parsed.data.people
    .map((p) => p.email?.toLowerCase())
    .filter((e): e is string => Boolean(e));
  const existing = emails.length
    ? await db.contact.findMany({
        where: { email: { in: emails } },
        select: { id: true, email: true },
      })
    : [];
  const existingByEmail = new Map(
    existing
      .filter((c) => c.email)
      .map((c) => [c.email!.toLowerCase(), c.id] as const),
  );
  const taken = new Set(existingByEmail.keys());

  let added = 0;
  let skipped = 0;
  const contactIds: string[] = [];

  for (const person of parsed.data.people) {
    if (person.email && taken.has(person.email.toLowerCase())) {
      skipped += 1;
      const existingId = existingByEmail.get(person.email.toLowerCase());
      if (existingId) contactIds.push(existingId);
      continue;
    }

    // Build the DATA_PARTNER field rows from whatever the provider gave us.
    const fieldPairs: Array<[string, string | undefined]> = [
      ["title", person.title],
      ["outletName", person.outletName],
      ["linkedinUrl", person.linkedinUrl],
      ["twitterUrl", person.twitterUrl],
      ["phone", person.phone],
      [
        "confidence",
        typeof person.confidence === "number"
          ? String(person.confidence)
          : undefined,
      ],
    ];
    const fields = fieldPairs
      .filter((pair): pair is [string, string] => Boolean(pair[1]))
      .map(([key, value]) => ({
        key,
        value,
        source: "DATA_PARTNER" as const,
      }));

    const contact = await db.contact.create({
      data: {
        name: person.fullName,
        kind: parsed.data.kind,
        email: person.email ?? null,
        phone: person.phone ?? null,
        fields: { create: fields },
      },
      select: { id: true },
    });

    // Attach an Outlet. Prefer a real domain; fall back to a manual pseudo
    // key from the outlet name (mirrors createContact) so contacts still
    // group by outlet in the table.
    if (person.domain || person.outletName) {
      const domainKey =
        person.domain?.replace(/^www\./, "").toLowerCase() ??
        `manual:${person.outletName!.toLowerCase().replace(/\s+/g, "-")}`;
      const outlet = await db.outlet.upsert({
        where: { domain: domainKey },
        create: {
          name: person.outletName ?? domainKey,
          domain: domainKey,
          kind: "PUBLICATION",
        },
        update: {},
      });
      await db.contactOutlet
        .create({
          data: { contactId: contact.id, outletId: outlet.id, isPrimary: true },
        })
        .catch(() => null);
    }

    await db.contactInteraction.create({
      data: {
        brandId,
        contactId: contact.id,
        kind: "NOTE",
        summary: "Added from partner search",
      },
    });

    if (person.email) taken.add(person.email.toLowerCase());
    contactIds.push(contact.id);
    added += 1;
  }

  revalidatePath("/dashboard/strategize/targets");
  return { ok: true, added, skipped, contactIds };
}
