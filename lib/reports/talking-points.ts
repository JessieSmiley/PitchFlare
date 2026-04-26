"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import type Anthropic from "@anthropic-ai/sdk";
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
 * Generate a talking-points document for spokespeople. Not a client-ready
 * narrative — it's an internal prep sheet: core messages, proof points,
 * likely tough questions + responses, phrases to avoid.
 */
export async function generateTalkingPoints(
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
    },
  });
  if (!campaign) return { ok: false, error: "Campaign not found." };

  const brandCtx = await getBrandContextForAI(campaign.brand.id);

  const factsBlock = [
    `CAMPAIGN: ${campaign.title}`,
    campaign.objective ? `Topic: ${campaign.objective}` : null,
    campaign.primaryAngle
      ? `Primary angle: ${campaign.primaryAngle.title} — ${campaign.primaryAngle.hook ?? ""}`
      : null,
    campaign.marketSentimentNotes
      ? `Market sentiment notes: ${campaign.marketSentimentNotes}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await anthropic.messages.create({
      model: MODELS.opus,
      max_tokens: 2500,
      system: [
        brandContextAsPromptBlock(brandCtx),
        {
          type: "text" as const,
          text: [
            "Generate talking points for spokespeople ahead of interviews",
            "and pitch calls. Use `## ` section headings and `- ` bullets.",
            "Deliver EXACTLY this structure:",
            "",
            "## Core messages (5)",
            "- Message 1 (one-sentence)",
            "  - Proof point A",
            "  - Proof point B",
            "  - Proof point C",
            "  (repeat for 2–5)",
            "",
            "## Tough questions (5)",
            "- Question — ...",
            "  Suggested response: ...",
            "",
            "## Phrases to avoid (3)",
            "- Phrase — why",
          ].join(" "),
        },
      ],
      messages: [{ role: "user", content: factsBlock }],
    });

    await logAIUsage({
      accountId: tenant.account.id,
      brandId: campaign.brand.id,
      feature: "report.talking_points",
      model: MODELS.opus,
      usage: response.usage,
    });

    const markdown = response.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const doc = await db.talkingPointsDoc.create({
      data: {
        campaignId: campaign.id,
        markdown,
        modelUsed: MODELS.opus,
      },
      select: { id: true },
    });

    revalidatePath("/dashboard/report");
    return { ok: true, reportId: doc.id, markdown };
  } catch (err) {
    console.error("generateTalkingPoints failed:", err);
    return { ok: false, error: "Talking points generation failed." };
  }
}
