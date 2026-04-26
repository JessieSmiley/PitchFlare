"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import { anthropic, MODELS, type ModelTier } from "@/lib/ai/anthropic";
import { logAIUsage } from "@/lib/ai/log";
import {
  brandContextAsPromptBlock,
  getBrandContextForAI,
} from "@/lib/brand/context";

type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

const PitchDraft = z.object({
  subject: z.string(),
  body: z.string(),
});
const VariantsOutput = z.object({
  variants: z
    .array(
      z.object({
        label: z.string(),
        subject: z.string(),
        body: z.string(),
      }),
    )
    .length(3),
});

/**
 * Internal helper — fetches the campaign + contact context for a pitch
 * call. Returns null if anything is missing or out of scope.
 */
async function loadPitchContext(campaignId: string, contactId: string) {
  const tenant = await requireTenant();
  const campaign = await db.campaign.findFirst({
    where: {
      id: campaignId,
      brand: { accountId: tenant.account.id },
    },
    include: { primaryAngle: true },
  });
  if (!campaign) return null;

  const contact = await db.contact.findUnique({
    where: { id: contactId },
    include: {
      outlets: {
        include: { outlet: { select: { name: true } } },
        where: { isPrimary: true },
        take: 1,
      },
      beats: { include: { beat: { select: { name: true } } } },
      recentWork: {
        select: { title: true, url: true, publishedAt: true },
        orderBy: { publishedAt: "desc" },
        take: 5,
      },
    },
  });
  if (!contact) return null;

  return { tenant, campaign, contact };
}

function contactBlock(contact: {
  name: string;
  kind: string;
  outlets: Array<{ outlet: { name: string } }>;
  beats: Array<{ beat: { name: string } }>;
  recentWork: Array<{ title: string; url: string }>;
}) {
  return [
    `CONTACT:`,
    `Name: ${contact.name}`,
    `Role: ${contact.kind}`,
    contact.outlets[0] ? `Outlet: ${contact.outlets[0].outlet.name}` : null,
    contact.beats.length
      ? `Beats: ${contact.beats.map((b) => b.beat.name).join(", ")}`
      : null,
    contact.recentWork.length
      ? `Recent work:\n${contact.recentWork.map((rw) => `- ${rw.title}`).join("\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function campaignBlock(campaign: {
  title: string;
  objective: string | null;
  goalType: string | null;
  toneTags: string[];
  primaryAngle: {
    title: string;
    hook: string | null;
    rationale: string | null;
  } | null;
}) {
  return [
    `CAMPAIGN:`,
    `Title: ${campaign.title}`,
    campaign.objective ? `Objective: ${campaign.objective}` : null,
    campaign.goalType ? `Goal: ${campaign.goalType}` : null,
    campaign.toneTags.length
      ? `Tone: ${campaign.toneTags.join(", ")}`
      : null,
    campaign.primaryAngle
      ? `PRIMARY ANGLE:\nTitle: ${campaign.primaryAngle.title}\nHook: ${campaign.primaryAngle.hook ?? ""}\nRationale: ${campaign.primaryAngle.rationale ?? ""}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

const PITCH_SYSTEM = [
  "You are drafting a single pitch email to a journalist, podcaster, or",
  "influencer on behalf of the brand. Strict rules: (1) under 150 words,",
  "(2) open with a specific reference to their recent work when possible,",
  "(3) match the brand voice exactly, (4) avoid banned words, (5) end with",
  "one clear, low-friction ask (quote, call, embargoed preview). No",
  "corporate throat-clearing.",
].join(" ");

const GenerateDraftInput = z.object({
  campaignId: z.string().min(1),
  contactId: z.string().min(1),
  useOpus: z.boolean().default(false),
});

/**
 * Generate a single pitch draft for (campaign, contact). Upserts a Pitch
 * row tied to the campaign's primary angle. Status stays DRAFT — nothing
 * auto-sends.
 */
export async function generatePitchDraft(
  input: z.input<typeof GenerateDraftInput>,
): Promise<ActionResult<{ pitchId: string; subject: string; body: string }>> {
  const parsed = GenerateDraftInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await loadPitchContext(parsed.data.campaignId, parsed.data.contactId);
  if (!ctx) return { ok: false, error: "Campaign or contact not found." };

  const brandCtx = await getBrandContextForAI(ctx.campaign.brandId);
  const tier: ModelTier = parsed.data.useOpus ? "opus" : "sonnet";
  const model = MODELS[tier];

  try {
    const response = await anthropic.messages.parse({
      model,
      max_tokens: 800,
      system: [
        brandContextAsPromptBlock(brandCtx),
        { type: "text" as const, text: PITCH_SYSTEM },
      ],
      messages: [
        {
          role: "user",
          content: [campaignBlock(ctx.campaign), "", contactBlock(ctx.contact)].join(
            "\n",
          ),
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              subject: { type: "string" },
              body: { type: "string" },
            },
            required: ["subject", "body"],
          },
        },
      },
    });

    await logAIUsage({
      accountId: ctx.tenant.account.id,
      brandId: ctx.campaign.brandId,
      feature: "draft.pitch_single",
      model,
      usage: response.usage,
    });

    const out = PitchDraft.safeParse(response.parsed_output);
    if (!out.success) {
      return { ok: false, error: "AI response didn't match expected shape." };
    }

    // Upsert by (campaignId, contactId, status = DRAFT). If a DRAFT already
    // exists for this pair we overwrite it; SENT/REPLIED rows stay put.
    const existing = await db.pitch.findFirst({
      where: {
        campaignId: ctx.campaign.id,
        contactId: ctx.contact.id,
        status: "DRAFT",
      },
      select: { id: true },
    });

    const row = existing
      ? await db.pitch.update({
          where: { id: existing.id },
          data: { subject: out.data.subject, body: out.data.body },
          select: { id: true },
        })
      : await db.pitch.create({
          data: {
            campaignId: ctx.campaign.id,
            contactId: ctx.contact.id,
            angleId: ctx.campaign.primaryAngleId ?? null,
            subject: out.data.subject,
            body: out.data.body,
            status: "DRAFT",
          },
          select: { id: true },
        });

    revalidatePath("/dashboard/draft/pitches");
    return { ok: true, pitchId: row.id, subject: out.data.subject, body: out.data.body };
  } catch (err) {
    console.error("generatePitchDraft failed:", err);
    return { ok: false, error: "Pitch generation failed. Try again." };
  }
}

const GenerateVariantsInput = z.object({
  campaignId: z.string().min(1),
  contactId: z.string().min(1),
  useOpus: z.boolean().default(false),
});

/**
 * Return 3 differently-toned variants for the same (campaign, contact).
 * Does NOT persist — the user picks one in the UI, then the pick is saved
 * via `updatePitchDraft`.
 */
export async function generatePitchVariants(
  input: z.input<typeof GenerateVariantsInput>,
): Promise<
  ActionResult<{
    variants: Array<{ label: string; subject: string; body: string }>;
  }>
> {
  const parsed = GenerateVariantsInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const ctx = await loadPitchContext(parsed.data.campaignId, parsed.data.contactId);
  if (!ctx) return { ok: false, error: "Campaign or contact not found." };

  const brandCtx = await getBrandContextForAI(ctx.campaign.brandId);
  const model = parsed.data.useOpus ? MODELS.opus : MODELS.sonnet;

  try {
    const response = await anthropic.messages.parse({
      model,
      max_tokens: 2000,
      system: [
        brandContextAsPromptBlock(brandCtx),
        {
          type: "text" as const,
          text:
            PITCH_SYSTEM +
            " Produce exactly 3 variants with meaningfully distinct tone (" +
            "e.g. direct/data-driven, warm/narrative, urgent/exclusive). " +
            "Label each with a 1-2 word tone descriptor.",
        },
      ],
      messages: [
        {
          role: "user",
          content: [campaignBlock(ctx.campaign), "", contactBlock(ctx.contact)].join(
            "\n",
          ),
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              variants: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    label: { type: "string" },
                    subject: { type: "string" },
                    body: { type: "string" },
                  },
                  required: ["label", "subject", "body"],
                },
              },
            },
            required: ["variants"],
          },
        },
      },
    });

    await logAIUsage({
      accountId: ctx.tenant.account.id,
      brandId: ctx.campaign.brandId,
      feature: "draft.pitch_variants",
      model,
      usage: response.usage,
    });

    const out = VariantsOutput.safeParse(response.parsed_output);
    if (!out.success) {
      return { ok: false, error: "AI response didn't match expected shape." };
    }
    return { ok: true, variants: out.data.variants };
  } catch (err) {
    console.error("generatePitchVariants failed:", err);
    return { ok: false, error: "Variant generation failed. Try again." };
  }
}

const BatchInput = z.object({
  campaignId: z.string().min(1),
  /** Contacts to fan out over — typically members of the primary MediaList. */
  contactIds: z.array(z.string().min(1)).min(1).max(100),
  useOpus: z.boolean().default(false),
});

/**
 * Generate drafts for many contacts sequentially. Run in a server action;
 * the UI polls by refreshing after each batch. We serialize (not parallel)
 * to keep per-account Claude concurrency low and avoid bursty 429s.
 */
export async function batchGeneratePitches(
  input: z.input<typeof BatchInput>,
): Promise<ActionResult<{ generated: number; failed: number }>> {
  const parsed = BatchInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let generated = 0;
  let failed = 0;
  for (const contactId of parsed.data.contactIds) {
    const res = await generatePitchDraft({
      campaignId: parsed.data.campaignId,
      contactId,
      useOpus: parsed.data.useOpus,
    });
    if (res.ok) generated += 1;
    else failed += 1;
  }
  return { ok: true, generated, failed };
}
