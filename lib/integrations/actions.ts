"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { providerFor } from "@/lib/providers";
import type { IntegrationPartner } from "@prisma/client";

type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

const ConnectInput = z.object({
  partner: z.enum(["HUNTER", "APOLLO", "PODCHASER", "SPARKTORO"]),
  apiKey: z.string().trim().min(8).max(500),
  label: z.string().trim().max(60).optional(),
});

/**
 * Store a BYO API key for a partner on the caller's Account. The key is
 * authenticated against the provider BEFORE we persist it so users can't
 * save a bad credential and then find out at enrichment time.
 *
 * Stored encrypted with AES-256-GCM (lib/crypto). The column is
 * `encryptedCredentials` — never select it back to the client; the
 * decrypt helper is server-only.
 */
export async function connectIntegration(
  input: z.input<typeof ConnectInput>,
): Promise<ActionResult> {
  const parsed = ConnectInput.safeParse(input);
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

  const auth = await provider.authenticate(parsed.data.apiKey);
  if (!auth.ok) {
    return {
      ok: false,
      error: auth.error ?? "Provider rejected the API key.",
    };
  }

  const encrypted = encryptSecret(parsed.data.apiKey);
  const label = parsed.data.label ?? "default";

  await db.integration.upsert({
    where: {
      accountId_partner_label: {
        accountId: tenant.account.id,
        partner,
        label,
      },
    },
    create: {
      accountId: tenant.account.id,
      partner,
      label,
      encryptedCredentials: encrypted,
      status: "CONNECTED",
    },
    update: {
      encryptedCredentials: encrypted,
      status: "CONNECTED",
      lastError: null,
    },
  });

  revalidatePath("/dashboard/settings/integrations");
  return { ok: true };
}

export async function disconnectIntegration(input: {
  integrationId: string;
}): Promise<ActionResult> {
  const tenant = await requireTenant();
  const integration = await db.integration.findFirst({
    where: { id: input.integrationId, accountId: tenant.account.id },
    select: { id: true },
  });
  if (!integration) return { ok: false, error: "Integration not found." };

  await db.integration.delete({ where: { id: integration.id } });
  revalidatePath("/dashboard/settings/integrations");
  return { ok: true };
}

const EnrichInput = z.object({
  contactId: z.string().min(1),
  partner: z.enum(["HUNTER", "APOLLO", "PODCHASER", "SPARKTORO"]),
});

/**
 * Enrich a Contact via the selected partner. Merges returned fields into
 * ContactField rows with `source: DATA_PARTNER` — NEVER overwriting
 * existing USER_ADDED values. We use upsert on (contactId, key, source)
 * which means multiple sources for the same key coexist (e.g. Hunter
 * found one email, user typed another — both rows survive and the UI
 * lets the user pick).
 */
export async function enrichContactWithPartner(
  input: z.input<typeof EnrichInput>,
): Promise<ActionResult<{ written: number; partnerFields: number }>> {
  const parsed = EnrichInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const tenant = await requireTenant();
  const partner = parsed.data.partner as IntegrationPartner;

  const integration = await db.integration.findFirst({
    where: {
      accountId: tenant.account.id,
      partner,
      status: "CONNECTED",
    },
  });
  if (!integration) {
    return {
      ok: false,
      error: `Connect ${partner} in Settings → Integrations first.`,
    };
  }

  const contact = await db.contact.findUnique({
    where: { id: parsed.data.contactId },
    include: {
      outlets: {
        include: { outlet: { select: { name: true, domain: true } } },
        where: { isPrimary: true },
        take: 1,
      },
      fields: {
        select: { key: true, source: true },
      },
    },
  });
  if (!contact) return { ok: false, error: "Contact not found." };

  const provider = providerFor(partner);
  if (!provider) return { ok: false, error: "Unknown provider." };

  const [firstName, ...rest] = contact.name.split(/\s+/);
  const lastName = rest.join(" ").trim() || undefined;

  const domain =
    contact.outlets[0]?.outlet.domain ??
    (contact.email ? contact.email.split("@")[1] : undefined);

  const input$ = {
    email: contact.email ?? undefined,
    domain,
    firstName: firstName || undefined,
    lastName,
    fullName: contact.name,
    outlet: contact.outlets[0]?.outlet.name ?? undefined,
  };

  if (!provider.supports(input$)) {
    return {
      ok: false,
      error: `${provider.label} needs a domain and a name to look this contact up.`,
    };
  }

  let enriched;
  try {
    const key = decryptSecret(integration.encryptedCredentials);
    enriched = await provider.enrich(key, input$);
  } catch (err) {
    await db.integration.update({
      where: { id: integration.id },
      data: {
        status: "ERROR",
        lastError: err instanceof Error ? err.message : "enrich failed",
      },
    });
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Enrichment failed.",
    };
  }

  // USER_ADDED keys are sacrosanct — we never touch them. Data-partner
  // writes for the same key just sit alongside as additional rows (the
  // @@unique is on (contactId, key, source), so multiple sources
  // coexist).
  const userAddedKeys = new Set(
    contact.fields
      .filter((f) => f.source === "USER_ADDED")
      .map((f) => f.key),
  );

  let written = 0;
  for (const f of enriched.fields) {
    if (!f.value) continue;
    if (userAddedKeys.has(f.key)) continue;
    await db.contactField.upsert({
      where: {
        contactId_key_source: {
          contactId: contact.id,
          key: f.key,
          source: "DATA_PARTNER",
        },
      },
      create: {
        contactId: contact.id,
        key: f.key,
        value: f.value,
        source: "DATA_PARTNER",
      },
      update: { value: f.value },
    });
    written += 1;
  }

  // If the provider surfaced an email and the Contact currently has none,
  // promote it to the primary email column too so Execute flows can use
  // it without reading ContactField.
  if (!contact.email) {
    const newEmail = enriched.fields.find((f) => f.key === "email")?.value;
    if (newEmail) {
      await db.contact.update({
        where: { id: contact.id },
        data: { email: newEmail },
      });
    }
  }

  await db.integration.update({
    where: { id: integration.id },
    data: { lastSyncAt: new Date(), lastError: null, status: "CONNECTED" },
  });

  revalidatePath("/dashboard/strategize/targets");
  return { ok: true, written, partnerFields: enriched.fields.length };
}
