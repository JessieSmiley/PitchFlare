"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import {
  anthropic,
  describeAIError,
  MODELS,
  type ModelTier,
} from "@/lib/ai/anthropic";
import { logAIUsage } from "@/lib/ai/log";
import {
  brandContextAsPromptBlock,
  getBrandContextForAI,
} from "@/lib/brand/context";

type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

function formatTimeline(start: Date | null, end: Date | null): string | null {
  if (!start && !end) return null;
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (start && end) return `Timeline: ${fmt(start)} to ${fmt(end)}`;
  return start
    ? `Timeline: starts ${fmt(start)}`
    : `Timeline: ends ${fmt(end!)}`;
}

const GeneratedAngleSchema = z.object({
  title: z.string(),
  hook: z.string(),
  rationale: z.string(),
  mediaFit: z.enum([
    "PRINT",
    "ONLINE",
    "PODCAST",
    "INFLUENCER",
    "TV",
    "TRADE",
  ]),
  risk: z.string(),
  newsworthinessScore: z.number().int().min(1).max(10),
  audienceFit: z.string(),
});
export type GeneratedAngle = z.infer<typeof GeneratedAngleSchema>;

// The prompt asks for exactly 5, but accept whatever non-empty set comes
// back rather than discarding good angles over a count mismatch.
const GenerateAnglesOutput = z.object({
  angles: z.array(GeneratedAngleSchema).min(1),
});

const GenerateAnglesInput = z.object({
  campaignId: z.string().min(1),
  useOpus: z.boolean().default(false),
  /** Optional steering note — e.g. "give me a more data-driven angle". */
  steer: z.string().trim().max(500).optional(),
});

/**
 * Generate 5 ranked pitch angles for the campaign. Uses the cached brand
 * context as the first system block so repeat calls within a session hit
 * the prompt cache.
 *
 * Non-streaming for now — the shape is small (5 structured angles) and
 * finishes under a second at Sonnet. Freeform chat on top of this will
 * stream in a later pass.
 */
export async function generateAngles(
  input: z.input<typeof GenerateAnglesInput>,
): Promise<ActionResult<{ angles: GeneratedAngle[] }>> {
  const parsed = GenerateAnglesInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const tenant = await requireTenant();
  const campaign = await db.campaign.findFirst({
    where: {
      id: parsed.data.campaignId,
      brand: { accountId: tenant.account.id },
    },
  });
  if (!campaign) return { ok: false, error: "Campaign not found." };

  const brandCtx = await getBrandContextForAI(campaign.brandId);

  const tier: ModelTier = parsed.data.useOpus ? "opus" : "sonnet";
  const model = MODELS[tier];

  const systemBlocks = [
    brandContextAsPromptBlock(brandCtx),
    {
      type: "text" as const,
      text: [
        "You are a senior PR strategist. Given the brand context above and",
        "the campaign parameters below, propose exactly 5 distinct pitch",
        "angles. Each angle must: (a) have a specific news-worthy hook,",
        "(b) fit the brand voice, (c) include a 1-paragraph strategic",
        "rationale, (d) name the best-fit media type, (e) flag one real risk",
        "or consideration, (f) carry a newsworthiness score 1-10. Rank by",
        "overall strength — index 0 is the strongest.",
      ].join(" "),
    },
  ];

  const campaignBlock = [
    `CAMPAIGN:`,
    `Title: ${campaign.title}`,
    campaign.objective ? `Objective: ${campaign.objective}` : null,
    campaign.goalType ? `Goal: ${campaign.goalType}` : null,
    campaign.toneTags.length
      ? `Tone tags: ${campaign.toneTags.join(", ")}`
      : null,
    campaign.budgetRange ? `Budget: ${campaign.budgetRange}` : null,
    formatTimeline(campaign.timelineStart, campaign.timelineEnd),
    campaign.marketSentimentTags.length
      ? `Market sentiment: ${campaign.marketSentimentTags.join(", ")}`
      : null,
    campaign.marketSentimentNotes
      ? `Market sentiment notes:\n${campaign.marketSentimentNotes}`
      : null,
    parsed.data.steer ? `User steering: ${parsed.data.steer}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await anthropic.messages.parse({
      model,
      max_tokens: 4096,
      system: systemBlocks,
      messages: [{ role: "user", content: campaignBlock }],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              angles: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    title: { type: "string" },
                    hook: { type: "string" },
                    rationale: { type: "string" },
                    mediaFit: {
                      type: "string",
                      enum: [
                        "PRINT",
                        "ONLINE",
                        "PODCAST",
                        "INFLUENCER",
                        "TV",
                        "TRADE",
                      ],
                    },
                    risk: { type: "string" },
                    newsworthinessScore: { type: "integer" },
                    audienceFit: { type: "string" },
                  },
                  required: [
                    "title",
                    "hook",
                    "rationale",
                    "mediaFit",
                    "risk",
                    "newsworthinessScore",
                    "audienceFit",
                  ],
                },
              },
            },
            required: ["angles"],
          },
        },
      },
    });

    await logAIUsage({
      accountId: tenant.account.id,
      brandId: campaign.brandId,
      feature: "ideation.generate_angles",
      model,
      usage: response.usage,
    });

    const out = GenerateAnglesOutput.safeParse(response.parsed_output);
    if (!out.success) {
      console.error(
        "generateAngles: shape mismatch",
        out.error.issues,
        JSON.stringify(response.parsed_output).slice(0, 2000),
      );
      return {
        ok: false,
        error:
          "The AI returned an unexpected format. Click Generate again to retry.",
      };
    }

    // Persist every generated angle as an Angle row. IdeationNote also
    // captures the full set for audit — we store the JSON as the note body.
    await db.$transaction([
      db.angle.createMany({
        data: out.data.angles.map((a) => ({
          campaignId: campaign.id,
          title: a.title,
          hook: a.hook,
          rationale: a.rationale,
          mediaFit: a.mediaFit,
          risk: a.risk,
          newsworthinessScore: a.newsworthinessScore,
          audienceFit: a.audienceFit,
          source: "IDEATION_STATION",
          aiGenerated: true,
        })),
      }),
      db.ideationNote.create({
        data: {
          campaignId: campaign.id,
          content: JSON.stringify(
            { steer: parsed.data.steer, angles: out.data.angles },
            null,
            2,
          ),
          aiGenerated: true,
          modelUsed: model,
        },
      }),
    ]);

    revalidatePath("/dashboard/strategize/ideation");
    return { ok: true, angles: out.data.angles };
  } catch (err) {
    console.error("generateAngles failed:", err);
    return {
      ok: false,
      error: `Ideation failed: ${describeAIError(err)}`,
    };
  }
}

const RemixAngleInput = z.object({
  campaignId: z.string().min(1),
  angleId: z.string().min(1),
  direction: z.string().trim().min(1).max(300),
  useOpus: z.boolean().default(false),
});

/**
 * "Remix" an existing angle: keep the strategic intent, but regenerate with
 * user-supplied steering (e.g. "make it more data-driven", "shift to a
 * podcast-first angle"). The remixed angle is appended to the campaign as
 * a new Angle row — the original is preserved so users can compare.
 */
export async function remixAngle(
  input: z.input<typeof RemixAngleInput>,
): Promise<ActionResult<{ angle: GeneratedAngle }>> {
  const parsed = RemixAngleInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const tenant = await requireTenant();
  const [campaign, original] = await Promise.all([
    db.campaign.findFirst({
      where: {
        id: parsed.data.campaignId,
        brand: { accountId: tenant.account.id },
      },
    }),
    db.angle.findUnique({ where: { id: parsed.data.angleId } }),
  ]);
  if (!campaign || !original || original.campaignId !== parsed.data.campaignId) {
    return { ok: false, error: "Angle not found on this campaign." };
  }

  const brandCtx = await getBrandContextForAI(campaign.brandId);
  const model = parsed.data.useOpus ? MODELS.opus : MODELS.sonnet;

  try {
    const response = await anthropic.messages.parse({
      model,
      max_tokens: 1024,
      system: [
        brandContextAsPromptBlock(brandCtx),
        {
          type: "text" as const,
          text: "Remix the given pitch angle according to the user's steering. Return a single angle in the same JSON shape.",
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            `ORIGINAL ANGLE:\nTitle: ${original.title}\nHook: ${original.hook ?? ""}\nRationale: ${original.rationale ?? ""}\nMedia fit: ${original.mediaFit ?? ""}\n`,
            `STEER: ${parsed.data.direction}`,
          ].join("\n"),
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              hook: { type: "string" },
              rationale: { type: "string" },
              mediaFit: {
                type: "string",
                enum: [
                  "PRINT",
                  "ONLINE",
                  "PODCAST",
                  "INFLUENCER",
                  "TV",
                  "TRADE",
                ],
              },
              risk: { type: "string" },
              newsworthinessScore: { type: "integer" },
              audienceFit: { type: "string" },
            },
            required: [
              "title",
              "hook",
              "rationale",
              "mediaFit",
              "risk",
              "newsworthinessScore",
              "audienceFit",
            ],
          },
        },
      },
    });

    await logAIUsage({
      accountId: tenant.account.id,
      brandId: campaign.brandId,
      feature: "ideation.remix_angle",
      model,
      usage: response.usage,
    });

    const remixed = GeneratedAngleSchema.safeParse(response.parsed_output);
    if (!remixed.success) {
      console.error(
        "remixAngle: shape mismatch",
        remixed.error.issues,
        JSON.stringify(response.parsed_output).slice(0, 2000),
      );
      return {
        ok: false,
        error:
          "The AI returned an unexpected format. Click Remix again to retry.",
      };
    }

    await db.angle.create({
      data: {
        campaignId: campaign.id,
        title: remixed.data.title,
        hook: remixed.data.hook,
        rationale: remixed.data.rationale,
        mediaFit: remixed.data.mediaFit,
        risk: remixed.data.risk,
        newsworthinessScore: remixed.data.newsworthinessScore,
        audienceFit: remixed.data.audienceFit,
        source: "IDEATION_STATION",
        aiGenerated: true,
      },
    });

    revalidatePath("/dashboard/strategize/ideation");
    return { ok: true, angle: remixed.data };
  } catch (err) {
    console.error("remixAngle failed:", err);
    return { ok: false, error: `Remix failed: ${describeAIError(err)}` };
  }
}

const GenerateCampaignBriefInput = z.object({
  campaignId: z.string().min(1),
  useOpus: z.boolean().default(false),
});

// Lenient on list lengths — the model occasionally returns an extra item or
// two, and rejecting an otherwise-good brief over that reads as a hard
// failure to the user. Counts are steered in the prompt instead.
const CampaignBriefSchema = z.object({
  positioning: z.string(),
  keyNarratives: z.array(z.string()).min(1),
  audienceSnapshot: z.string(),
  competitiveContext: z.string(),
  risks: z.array(z.string()),
  recommendedNextSteps: z.array(z.string()).min(1),
});
export type CampaignBrief = z.infer<typeof CampaignBriefSchema>;

/**
 * Generate a synthesized campaign brief: the AI's read of the campaign
 * fields + brand context, presented back to the user before they kick off
 * ideation. Persisted on `Campaign` so it survives page reloads.
 */
export async function generateCampaignBrief(
  input: z.input<typeof GenerateCampaignBriefInput>,
): Promise<ActionResult<{ brief: CampaignBrief; generatedAt: string }>> {
  const parsed = GenerateCampaignBriefInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const tenant = await requireTenant();
  const campaign = await db.campaign.findFirst({
    where: {
      id: parsed.data.campaignId,
      brand: { accountId: tenant.account.id },
    },
  });
  if (!campaign) return { ok: false, error: "Campaign not found." };

  const brandCtx = await getBrandContextForAI(campaign.brandId);
  const tier: ModelTier = parsed.data.useOpus ? "opus" : "sonnet";
  const model = MODELS[tier];

  const systemBlocks = [
    brandContextAsPromptBlock(brandCtx),
    {
      type: "text" as const,
      text: [
        "You are a senior PR strategist. Read the brand context above and",
        "the campaign parameters below, then produce a tight campaign brief",
        "the user can scan in 30 seconds. The brief is what we'll use to",
        "anchor the rest of the campaign. Be concrete, opinionated, and",
        "specific to this brand — no generic platitudes.",
        "Include 3-5 key narratives, up to 5 risks, and 3-5 recommended",
        "next steps.",
      ].join(" "),
    },
  ];

  const campaignBlock = [
    `CAMPAIGN:`,
    `Title: ${campaign.title}`,
    campaign.objective ? `Topic / announcement: ${campaign.objective}` : null,
    campaign.goalType ? `Primary goal: ${campaign.goalType}` : null,
    campaign.toneTags.length
      ? `Tone tags: ${campaign.toneTags.join(", ")}`
      : null,
    campaign.budgetRange ? `Budget range: ${campaign.budgetRange}` : null,
    formatTimeline(campaign.timelineStart, campaign.timelineEnd),
    campaign.marketSentimentTags.length
      ? `Market sentiment: ${campaign.marketSentimentTags.join(", ")}`
      : null,
    campaign.marketSentimentNotes
      ? `Market sentiment notes:\n${campaign.marketSentimentNotes}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await anthropic.messages.parse({
      model,
      max_tokens: 4096,
      system: systemBlocks,
      messages: [{ role: "user", content: campaignBlock }],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              positioning: { type: "string" },
              keyNarratives: {
                type: "array",
                items: { type: "string" },
              },
              audienceSnapshot: { type: "string" },
              competitiveContext: { type: "string" },
              risks: {
                type: "array",
                items: { type: "string" },
              },
              recommendedNextSteps: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: [
              "positioning",
              "keyNarratives",
              "audienceSnapshot",
              "competitiveContext",
              "risks",
              "recommendedNextSteps",
            ],
          },
        },
      },
    });

    await logAIUsage({
      accountId: tenant.account.id,
      brandId: campaign.brandId,
      feature: "strategize.campaign_brief",
      model,
      usage: response.usage,
    });

    const parsedBrief = CampaignBriefSchema.safeParse(response.parsed_output);
    if (!parsedBrief.success) {
      console.error(
        "generateCampaignBrief: shape mismatch",
        parsedBrief.error.issues,
        JSON.stringify(response.parsed_output).slice(0, 2000),
      );
      return {
        ok: false,
        error:
          "The AI returned an unexpected format. Click Generate again to retry.",
      };
    }

    const generatedAt = new Date();
    await db.campaign.update({
      where: { id: campaign.id },
      data: {
        briefSummary: JSON.stringify(parsedBrief.data),
        briefGeneratedAt: generatedAt,
        briefModelUsed: model,
      },
    });

    revalidatePath("/dashboard/strategize/ideation");
    return {
      ok: true,
      brief: parsedBrief.data,
      generatedAt: generatedAt.toISOString(),
    };
  } catch (err) {
    console.error("generateCampaignBrief failed:", err);
    return {
      ok: false,
      error: `Brief generation failed: ${describeAIError(err)}`,
    };
  }
}
