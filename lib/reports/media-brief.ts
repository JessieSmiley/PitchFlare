"use server";

import { z } from "zod";
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

const InterviewDetailsSchema = z
  .object({
    when: z.string().trim().optional(),
    platform: z.string().trim().optional(),
    zoomLink: z.string().trim().url().optional().or(z.literal("")),
    notes: z.string().trim().max(1000).optional(),
    questions: z.array(z.string().trim()).optional(),
  })
  .partial();
export type InterviewDetails = z.infer<typeof InterviewDetailsSchema>;

const GenerateInput = z.object({
  contactId: z.string().min(1),
  /** Tying to a campaign is optional — briefs are sometimes brand-general. */
  campaignId: z.string().min(1).optional(),
  interviewDetails: InterviewDetailsSchema.optional(),
});

/**
 * Generate a one-pager media brief for a spokesperson to read before an
 * interview. Contact bio + recent work + AI pitch notes + interview
 * logistics → Claude Opus writes the narrative. Persists to MediaBriefDoc.
 */
export async function generateMediaBrief(
  input: z.input<typeof GenerateInput>,
): Promise<ActionResult<{ reportId: string; markdown: string }>> {
  const parsed = GenerateInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const tenant = await requireTenant();
  if (!tenant.brand) return { ok: false, error: "No brand selected." };

  const [contact, campaign] = await Promise.all([
    db.contact.findUnique({
      where: { id: parsed.data.contactId },
      include: {
        outlets: {
          include: { outlet: { select: { name: true, domain: true } } },
          where: { isPrimary: true },
          take: 1,
        },
        beats: { include: { beat: { select: { name: true } } } },
        recentWork: {
          orderBy: { publishedAt: "desc" },
          take: 5,
        },
        notes: {
          where: { brandId: tenant.brand.id },
          take: 1,
        },
      },
    }),
    parsed.data.campaignId
      ? db.campaign.findFirst({
          where: {
            id: parsed.data.campaignId,
            brand: { accountId: tenant.account.id },
          },
          include: { primaryAngle: true },
        })
      : Promise.resolve(null),
  ]);
  if (!contact) return { ok: false, error: "Contact not found." };

  const brandCtx = await getBrandContextForAI(tenant.brand.id);

  const factsBlock = [
    `CONTACT:`,
    `Name: ${contact.name}`,
    `Role: ${contact.kind}`,
    contact.outlets[0] ? `Outlet: ${contact.outlets[0].outlet.name}` : null,
    contact.bio ? `Bio: ${contact.bio}` : null,
    contact.beats.length
      ? `Beats: ${contact.beats.map((b) => b.beat.name).join(", ")}`
      : null,
    contact.recentWork.length
      ? `Recent work:\n${contact.recentWork.map((rw) => `- ${rw.title}`).join("\n")}`
      : null,
    contact.notes[0] ? `Pitch notes (AI):\n${contact.notes[0].body}` : null,
    campaign?.primaryAngle
      ? `CAMPAIGN ANGLE:\n${campaign.primaryAngle.title} — ${campaign.primaryAngle.hook ?? ""}`
      : campaign
        ? `CAMPAIGN: ${campaign.title}`
        : null,
    parsed.data.interviewDetails
      ? `INTERVIEW:\n${JSON.stringify(parsed.data.interviewDetails, null, 2)}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await anthropic.messages.create({
      model: MODELS.opus,
      max_tokens: 2000,
      system: [
        brandContextAsPromptBlock(brandCtx),
        {
          type: "text" as const,
          text: [
            "You are writing a one-page media brief for a spokesperson to",
            "read before an interview. Structure with `## Section` headings:",
            "Who you're talking to · What they cover · Likely tone/style ·",
            "Recent articles to acknowledge · Angles they'll pull toward ·",
            "Topics to steer toward · Quick logistics (if provided).",
            "Be concise — the spokesperson will skim this on the way in.",
            "Under 500 words. No filler.",
          ].join(" "),
        },
      ],
      messages: [{ role: "user", content: factsBlock }],
    });

    await logAIUsage({
      accountId: tenant.account.id,
      brandId: tenant.brand.id,
      feature: "report.media_brief",
      model: MODELS.opus,
      usage: response.usage,
    });

    const markdown = response.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const doc = await db.mediaBriefDoc.create({
      data: {
        contactId: contact.id,
        campaignId: campaign?.id ?? null,
        markdown,
        interviewDetails: parsed.data.interviewDetails ?? undefined,
        modelUsed: MODELS.opus,
      },
      select: { id: true },
    });

    revalidatePath("/dashboard/report");
    return { ok: true, reportId: doc.id, markdown };
  } catch (err) {
    console.error("generateMediaBrief failed:", err);
    return { ok: false, error: "Media brief generation failed." };
  }
}
