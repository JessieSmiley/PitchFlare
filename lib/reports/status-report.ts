"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import { anthropic, MODELS } from "@/lib/ai/anthropic";
import { logAIUsage } from "@/lib/ai/log";
import {
  brandContextAsPromptBlock,
  getBrandContextForAI,
} from "@/lib/brand/context";

type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

/**
 * Generate an on-demand status report for a campaign. Pulls current
 * phase + contact/pitch/clip stats + next actions and asks Opus 4.7 to
 * narrate it the way a PR consultant would brief a CEO or client.
 *
 * Writes a StatusReportDoc row with the final markdown so it's shareable
 * later via the PDF download endpoint.
 */
export async function generateStatusReport(
  input: { campaignId: string },
): Promise<ActionResult<{ reportId: string; markdown: string }>> {
  const tenant = await requireTenant();
  const campaign = await db.campaign.findFirst({
    where: {
      id: input.campaignId,
      brand: { accountId: tenant.account.id },
    },
    include: {
      brand: { select: { id: true, name: true } },
      primaryAngle: true,
      pitches: {
        select: { status: true, sentAt: true, subject: true },
      },
      coverageClips: {
        select: {
          headline: true,
          publishedAt: true,
          sentimentLabel: true,
          reachEstimate: true,
          url: true,
          outlet: { select: { name: true } },
        },
        orderBy: { publishedAt: "desc" },
        take: 20,
      },
    },
  });
  if (!campaign) return { ok: false, error: "Campaign not found." };

  const byStatus = campaign.pitches.reduce<Record<string, number>>(
    (acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const totalReach = campaign.coverageClips.reduce(
    (s, c) => s + (c.reachEstimate ?? 0),
    0,
  );
  const sentiment = campaign.coverageClips.reduce(
    (acc, c) => {
      if (c.sentimentLabel === "POSITIVE") acc.pos += 1;
      else if (c.sentimentLabel === "NEGATIVE") acc.neg += 1;
      else if (c.sentimentLabel === "NEUTRAL") acc.neu += 1;
      return acc;
    },
    { pos: 0, neu: 0, neg: 0 },
  );

  const factsBlock = [
    `CAMPAIGN: ${campaign.title}`,
    `Phase: ${campaign.phase}`,
    campaign.objective ? `Objective: ${campaign.objective}` : null,
    campaign.primaryAngle
      ? `Primary angle: ${campaign.primaryAngle.title} — ${campaign.primaryAngle.hook ?? ""}`
      : null,
    "",
    `PITCHES: ${campaign.pitches.length} total`,
    `  sent: ${byStatus.SENT ?? 0}`,
    `  opened: ${byStatus.OPENED ?? 0}`,
    `  replied: ${byStatus.REPLIED ?? 0}`,
    `  placed: ${byStatus.PLACED ?? 0}`,
    `  no response: ${byStatus.NO_RESPONSE ?? 0}`,
    "",
    `COVERAGE: ${campaign.coverageClips.length} clips, est. reach ${totalReach.toLocaleString()}`,
    `  positive: ${sentiment.pos} · neutral: ${sentiment.neu} · negative: ${sentiment.neg}`,
    ...campaign.coverageClips
      .slice(0, 10)
      .map(
        (c) =>
          `  - ${c.outlet?.name ?? "(outlet)"} — ${c.headline} [${c.sentimentLabel ?? "UNRATED"}]`,
      ),
  ]
    .filter((x) => x !== null)
    .join("\n");

  const brandCtx = await getBrandContextForAI(campaign.brand.id);

  try {
    const response = await anthropic.messages.create({
      model: MODELS.opus,
      max_tokens: 2000,
      system: [
        brandContextAsPromptBlock(brandCtx),
        {
          type: "text" as const,
          text: [
            "You are writing a status report for a CEO or agency client.",
            "Lead with outcomes, then risks, then concrete next steps.",
            "Use clear `## Section` headings and `- bullet` lists. Keep it",
            "under 600 words. Avoid hedging language and filler.",
            "Structure: Summary · Coverage highlights · Outreach status ·",
            "Risks · Next actions.",
          ].join(" "),
        },
      ],
      messages: [{ role: "user", content: factsBlock }],
    });

    await logAIUsage({
      accountId: tenant.account.id,
      brandId: campaign.brand.id,
      feature: "report.status",
      model: MODELS.opus,
      usage: response.usage,
    });

    const markdown = response.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const doc = await db.statusReportDoc.create({
      data: {
        campaignId: campaign.id,
        markdown,
        modelUsed: MODELS.opus,
      },
      select: { id: true },
    });

    revalidatePath("/dashboard/report");
    revalidatePath("/dashboard/report/status");
    return { ok: true, reportId: doc.id, markdown };
  } catch (err) {
    console.error("generateStatusReport failed:", err);
    return { ok: false, error: "Status report generation failed." };
  }
}
