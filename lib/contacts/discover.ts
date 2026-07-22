"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import { decryptSecret } from "@/lib/crypto";
import { providerFor } from "@/lib/providers";
import type { DiscoveredPerson } from "@/lib/providers/types";
import type { IntegrationPartner } from "@prisma/client";

type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

const DiscoverInputSchema = z.object({
  partner: z.enum(["HUNTER", "APOLLO", "PODCHASER", "SPARKTORO"]),
  query: z.string().trim().min(2).max(120),
  limit: z.number().int().min(1).max(100).optional(),
});

/**
 * Search a connected data partner for candidate contacts matching a
 * free-text query (typically an outlet/company name from the Targets
 * search bar). Read-only: this spends the user's partner credits but
 * persists nothing — the returned candidates are staged in the UI and
 * only saved when the user picks them via addDiscoveredContacts.
 *
 * Guard rails mirror enrichContactWithPartner: a missing/unusable key
 * surfaces a friendly "connect it first" message, and a provider failure
 * flips the Integration to ERROR with the reason so Settings shows it.
 */
export async function discoverContacts(
  input: z.input<typeof DiscoverInputSchema>,
): Promise<ActionResult<{ people: DiscoveredPerson[]; outletName?: string }>> {
  const parsed = DiscoverInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const tenant = await requireTenant();
  const partner = parsed.data.partner as IntegrationPartner;

  const provider = providerFor(partner);
  if (!provider) return { ok: false, error: "Unknown provider." };
  if (!provider.supportsDiscovery || !provider.discover) {
    return {
      ok: false,
      error: `${provider.label} doesn't support contact search yet.`,
    };
  }

  const integration = await db.integration.findFirst({
    where: { accountId: tenant.account.id, partner, status: "CONNECTED" },
  });
  if (!integration) {
    return {
      ok: false,
      error: `Connect ${provider.label} in Settings → Integrations to search for contacts.`,
    };
  }

  let result;
  try {
    const key = decryptSecret(integration.encryptedCredentials);
    result = await provider.discover(key, {
      query: parsed.data.query,
      // Bias toward press/editorial roles by default. Hunter maps this to
      // its `communication` department; other providers may ignore it.
      department: "communication",
      limit: parsed.data.limit ?? 25,
    });
  } catch (err) {
    await db.integration.update({
      where: { id: integration.id },
      data: {
        status: "ERROR",
        lastError: err instanceof Error ? err.message : "discovery failed",
      },
    });
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Contact search failed.",
    };
  }

  await db.integration.update({
    where: { id: integration.id },
    data: { lastSyncAt: new Date(), lastError: null, status: "CONNECTED" },
  });

  return {
    ok: true,
    people: result.people,
    outletName: result.outletName,
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
): Promise<ActionResult<{ added: number; skipped: number }>> {
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

  // Dedup against existing contacts by email in one query up front.
  const emails = parsed.data.people
    .map((p) => p.email?.toLowerCase())
    .filter((e): e is string => Boolean(e));
  const existing = emails.length
    ? await db.contact.findMany({
        where: { email: { in: emails } },
        select: { email: true },
      })
    : [];
  const taken = new Set(
    existing.map((c) => c.email?.toLowerCase()).filter(Boolean),
  );

  let added = 0;
  let skipped = 0;

  for (const person of parsed.data.people) {
    if (person.email && taken.has(person.email.toLowerCase())) {
      skipped += 1;
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
    added += 1;
  }

  revalidatePath("/dashboard/strategize/targets");
  return { ok: true, added, skipped };
}
