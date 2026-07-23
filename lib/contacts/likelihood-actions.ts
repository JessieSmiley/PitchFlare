"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import {
  EXCLUSIVES_FIELD_KEY,
  PR_DRIVEN_FIELD_KEY,
  getContactLikelihood,
  invalidateLikelihood,
  resolveCampaignTopicTerms,
} from "./likelihood-service";

type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

const SIGNAL_KEYS = {
  exclusives: EXCLUSIVES_FIELD_KEY,
  prDriven: PR_DRIVEN_FIELD_KEY,
} as const;

const SetSignalInput = z.object({
  contactId: z.string().min(1),
  signal: z.enum(["exclusives", "prDriven"]),
  value: z.enum(["yes", "no", "clear"]),
});

/**
 * Confirm or clear a behavioral flag on a contact ("prefers exclusives",
 * "rarely writes PR-driven stories"). A human decision is written as
 * USER_ADDED, which outranks any AI_INFERRED guess in the field-provenance
 * model — so confirming a value locks it against future inference passes.
 * Clearing removes the user value (an inferred one, if present, resurfaces).
 */
export async function setContactSignal(
  input: z.input<typeof SetSignalInput>,
): Promise<ActionResult> {
  const parsed = SetSignalInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const tenant = await requireTenant();
  if (!tenant.brand) return { ok: false, error: "No brand selected." };

  const key = SIGNAL_KEYS[parsed.data.signal];
  const contact = await db.contact.findUnique({
    where: { id: parsed.data.contactId },
    select: { id: true },
  });
  if (!contact) return { ok: false, error: "Contact not found." };

  if (parsed.data.value === "clear") {
    await db.contactField.deleteMany({
      where: { contactId: contact.id, key, source: "USER_ADDED" },
    });
  } else {
    // A user decision is USER_ADDED; the unique key is (contactId, key, source)
    // so this never collides with an AI_INFERRED row for the same key.
    await db.contactField.upsert({
      where: {
        contactId_key_source: {
          contactId: contact.id,
          key,
          source: "USER_ADDED",
        },
      },
      create: {
        contactId: contact.id,
        key,
        value: parsed.data.value,
        source: "USER_ADDED",
      },
      update: { value: parsed.data.value },
    });
  }

  // The flag feeds the score — drop cached likelihoods so they recompute.
  await invalidateLikelihood(tenant.brand.id, contact.id);
  revalidatePath("/dashboard/strategize/targets");
  return { ok: true };
}

const RefineInput = z.object({
  contactId: z.string().min(1),
  campaignId: z.string().nullable().optional(),
});

/**
 * Regenerate a contact's likelihood rationale with Claude (Haiku) and return
 * the refined sentence. User-initiated from the drawer so we don't spend tokens
 * on every row; the result is cached in CoverageLikelihood.
 */
export async function refineContactRationale(
  input: z.input<typeof RefineInput>,
): Promise<ActionResult<{ rationale: string; score: number }>> {
  const parsed = RefineInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const tenant = await requireTenant();
  if (!tenant.brand) return { ok: false, error: "No brand selected." };

  const campaignId = parsed.data.campaignId ?? null;
  const topicTerms = campaignId
    ? await resolveCampaignTopicTerms(tenant.brand.id, campaignId)
    : [];

  // Force a fresh AI pass rather than serving whatever is cached.
  await invalidateLikelihood(tenant.brand.id, parsed.data.contactId);
  const result = await getContactLikelihood(tenant.brand.id, parsed.data.contactId, {
    campaignId,
    topicTerms,
    accountId: tenant.account.id,
    useAI: true,
  });

  revalidatePath("/dashboard/strategize/targets");
  return { ok: true, rationale: result.rationale, score: result.score };
}
