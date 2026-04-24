"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import type { Campaign } from "@prisma/client";

type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

async function requireCampaign(campaignId: string) {
  const tenant = await requireTenant();
  const campaign = await db.campaign.findFirst({
    where: {
      id: campaignId,
      brand: { accountId: tenant.account.id },
    },
  });
  if (!campaign) throw new Error("Campaign not found in current account.");
  return { tenant, campaign };
}

const CreateCampaignInput = z.object({
  title: z.string().trim().min(1).max(120),
  objective: z.string().trim().max(1000).optional().nullable(),
  goalType: z
    .enum([
      "AWARENESS",
      "THOUGHT_LEADERSHIP",
      "LAUNCH",
      "CRISIS_RESPONSE",
      "FUNDING",
      "PARTNERSHIP",
    ])
    .optional(),
  toneTags: z.array(z.string().trim()).max(12).optional(),
  budgetRange: z.string().trim().optional().nullable(),
  timelineStart: z.string().datetime().optional().nullable(),
  timelineEnd: z.string().datetime().optional().nullable(),
  marketSentimentNotes: z.string().trim().max(2000).optional().nullable(),
});

export async function createCampaign(
  input: z.infer<typeof CreateCampaignInput>,
): Promise<ActionResult<{ campaign: Campaign }>> {
  const parsed = CreateCampaignInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const tenant = await requireTenant();
  if (!tenant.brand) return { ok: false, error: "No brand selected." };

  const campaign = await db.campaign.create({
    data: {
      brandId: tenant.brand.id,
      title: parsed.data.title,
      objective: parsed.data.objective ?? null,
      goalType: parsed.data.goalType ?? null,
      toneTags: parsed.data.toneTags ?? [],
      budgetRange: parsed.data.budgetRange ?? null,
      timelineStart: parsed.data.timelineStart
        ? new Date(parsed.data.timelineStart)
        : null,
      timelineEnd: parsed.data.timelineEnd
        ? new Date(parsed.data.timelineEnd)
        : null,
      marketSentimentNotes: parsed.data.marketSentimentNotes ?? null,
      phase: "STRATEGIZE",
      status: "DRAFT",
    },
  });

  revalidatePath("/dashboard/strategize/ideation");
  return { ok: true, campaign };
}

const UpdateCampaignInput = CreateCampaignInput.partial().extend({
  id: z.string().min(1),
});

export async function updateCampaign(
  input: z.infer<typeof UpdateCampaignInput>,
): Promise<ActionResult> {
  const parsed = UpdateCampaignInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  await requireCampaign(parsed.data.id);

  const { id, timelineStart, timelineEnd, ...rest } = parsed.data;

  await db.campaign.update({
    where: { id },
    data: {
      ...rest,
      timelineStart: timelineStart ? new Date(timelineStart) : undefined,
      timelineEnd: timelineEnd ? new Date(timelineEnd) : undefined,
    },
  });

  revalidatePath("/dashboard/strategize/ideation");
  return { ok: true };
}

/**
 * Promotes an Angle to the campaign's primary angle. This is what
 * Target Compilation and Pitch Composer read from — setting it also
 * advances the campaign's workflow visually (though phases aren't
 * auto-bumped; the user moves through phases explicitly).
 */
export async function setPrimaryAngle(
  input: { campaignId: string; angleId: string },
): Promise<ActionResult> {
  const { campaign } = await requireCampaign(input.campaignId);

  // Verify angle belongs to campaign.
  const angle = await db.angle.findFirst({
    where: { id: input.angleId, campaignId: campaign.id },
    select: { id: true },
  });
  if (!angle) return { ok: false, error: "Angle not found on this campaign." };

  await db.campaign.update({
    where: { id: campaign.id },
    data: { primaryAngleId: angle.id },
  });

  revalidatePath("/dashboard/strategize/ideation");
  revalidatePath("/dashboard/strategize/targets");
  return { ok: true };
}

export async function deleteAngle(
  input: { campaignId: string; angleId: string },
): Promise<ActionResult> {
  await requireCampaign(input.campaignId);
  await db.angle.delete({ where: { id: input.angleId } });
  revalidatePath("/dashboard/strategize/ideation");
  return { ok: true };
}

export async function goToFirstCampaignOrCreate() {
  const tenant = await requireTenant();
  if (!tenant.brand) redirect("/onboarding/brand");
  const existing = await db.campaign.findFirst({
    where: { brandId: tenant.brand.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (existing) {
    redirect(`/dashboard/strategize/ideation?campaignId=${existing.id}`);
  }
  redirect("/dashboard/strategize/ideation");
}
