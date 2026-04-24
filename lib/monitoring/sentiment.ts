import { z } from "zod";
import { anthropic, MODELS } from "@/lib/ai/anthropic";
import { logAIUsage } from "@/lib/ai/log";

export const SentimentOutput = z.object({
  score: z.number().min(-1).max(1),
  label: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE"]),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  reachEstimate: z.number().int().nonnegative().optional(),
});
export type SentimentResult = z.infer<typeof SentimentOutput>;

/**
 * Claude-scored sentiment for a coverage clip. Uses Haiku — the task is
 * pure classification + a one-sentence rationale and latency matters when
 * this runs inline on a user-triggered "Add coverage" flow.
 *
 * We also ask Claude for a rough monthly-uniques reach estimate (published
 * audience size × 1 article) so the Analyze metrics row has something to
 * sum. It's a guess and we surface it as such — real reach data lives in
 * paid providers we'd plug in later.
 */
export async function scoreSentimentForClip(opts: {
  brandName: string;
  clipTitle: string;
  outlet: string | null;
  excerpt: string | null;
  accountId: string;
  brandId: string;
}): Promise<SentimentResult | null> {
  try {
    const response = await anthropic.messages.parse({
      model: MODELS.haiku,
      max_tokens: 512,
      system:
        "You classify sentiment toward a specified brand in a news clip. Base your answer strictly on the provided title and excerpt — no outside knowledge. Confidence 0-1 reflects how clear-cut the sentiment is. Reach is a rough monthly-uniques guess for the outlet, integer; omit if you truly don't know the outlet.",
      messages: [
        {
          role: "user",
          content: [
            `BRAND: ${opts.brandName}`,
            `OUTLET: ${opts.outlet ?? "(unknown)"}`,
            `HEADLINE: ${opts.clipTitle}`,
            opts.excerpt ? `EXCERPT:\n${opts.excerpt}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              score: { type: "number" },
              label: {
                type: "string",
                enum: ["POSITIVE", "NEUTRAL", "NEGATIVE"],
              },
              confidence: { type: "number" },
              rationale: { type: "string" },
              reachEstimate: { type: "integer" },
            },
            required: ["score", "label", "confidence", "rationale"],
          },
        },
      },
    });

    await logAIUsage({
      accountId: opts.accountId,
      brandId: opts.brandId,
      feature: "analyze.sentiment",
      model: MODELS.haiku,
      usage: response.usage,
    });

    const parsed = SentimentOutput.safeParse(response.parsed_output);
    return parsed.success ? parsed.data : null;
  } catch (err) {
    console.error("scoreSentimentForClip failed:", err);
    return null;
  }
}
