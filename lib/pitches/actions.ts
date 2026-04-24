"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";

type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

async function requirePitch(pitchId: string) {
  const tenant = await requireTenant();
  const pitch = await db.pitch.findFirst({
    where: {
      id: pitchId,
      campaign: { brand: { accountId: tenant.account.id } },
    },
    include: {
      contact: { select: { id: true, name: true, email: true } },
      campaign: { select: { id: true, brandId: true, title: true } },
    },
  });
  if (!pitch) throw new Error("Pitch not found in current account.");
  return { tenant, pitch };
}

const UpdatePitchInput = z.object({
  pitchId: z.string().min(1),
  subject: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().min(1).max(20000).optional(),
});

export async function updatePitchDraft(
  input: z.infer<typeof UpdatePitchInput>,
): Promise<ActionResult> {
  const parsed = UpdatePitchInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { pitch } = await requirePitch(parsed.data.pitchId);
  if (pitch.status !== "DRAFT" && pitch.status !== "APPROVED") {
    return { ok: false, error: "Pitch already sent — cannot edit." };
  }

  await db.pitch.update({
    where: { id: pitch.id },
    data: {
      subject: parsed.data.subject,
      body: parsed.data.body,
    },
  });
  revalidatePath("/dashboard/draft/pitches");
  return { ok: true };
}

export async function approvePitch(
  input: { pitchId: string },
): Promise<ActionResult> {
  const { pitch } = await requirePitch(input.pitchId);
  if (pitch.status !== "DRAFT") {
    return { ok: false, error: "Only drafts can be approved." };
  }
  await db.pitch.update({
    where: { id: pitch.id },
    data: { status: "APPROVED" },
  });
  revalidatePath("/dashboard/draft/pitches");
  revalidatePath("/dashboard/execute/email");
  return { ok: true };
}

export async function deletePitch(
  input: { pitchId: string },
): Promise<ActionResult> {
  const { pitch } = await requirePitch(input.pitchId);
  if (pitch.status !== "DRAFT" && pitch.status !== "APPROVED") {
    return { ok: false, error: "Can't delete a sent pitch." };
  }
  await db.pitch.delete({ where: { id: pitch.id } });
  revalidatePath("/dashboard/draft/pitches");
  return { ok: true };
}
