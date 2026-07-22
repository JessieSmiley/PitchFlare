import { z } from "zod";
import { anthropic, MODELS } from "@/lib/ai/anthropic";
import { logAIUsage } from "@/lib/ai/log";
import type { FundingFact, LinkRef, PersonRef } from "../types";

/**
 * Claude-based fact extraction for Company Intelligence. Free Tier-1 sources
 * (crawl + Schema.org) reliably give name/socials/press links, but funding,
 * awards, podcast appearances, and a clean executive list are usually only
 * present as prose. Haiku pulls them out of the crawled text — a cheap
 * "normalization" transform per the model-routing policy (SPEC §4.3).
 *
 * Best-effort by design: no ANTHROPIC key, an API failure, or a bad parse
 * all return null so the free profile still ships. Runs only on a cache
 * MISS (the caller gates it), and the result is persisted on CompanyProfile,
 * so we pay for extraction at most once per company per refresh window.
 */

const ExtractOutput = z.object({
  description: z.string().optional(),
  funding: z
    .array(
      z.object({
        round: z.string().optional(),
        amount: z.string().optional(),
        date: z.string().optional(),
      }),
    )
    .optional(),
  executives: z
    .array(
      z.object({
        name: z.string(),
        title: z.string().optional(),
      }),
    )
    .optional(),
  awards: z
    .array(z.object({ title: z.string() }))
    .optional(),
  podcasts: z
    .array(z.object({ title: z.string() }))
    .optional(),
});

export type CompanyFacts = {
  description?: string;
  funding?: FundingFact[];
  executives?: PersonRef[];
  awards?: LinkRef[];
  podcasts?: LinkRef[];
};

export async function extractCompanyFacts(opts: {
  name: string;
  domain: string;
  textSample?: string;
  pressTitles?: string[];
  accountId?: string;
}): Promise<CompanyFacts | null> {
  // Guard the env read — env.ANTHROPIC_API_KEY throws if unset, and we want
  // a silent skip (free profile still works) rather than an error.
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const source = [
    opts.textSample,
    opts.pressTitles?.length
      ? `RECENT HEADLINES:\n${opts.pressTitles.slice(0, 10).join("\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();
  if (source.length < 40) return null; // nothing worth a model call

  try {
    const response = await anthropic.messages.parse({
      model: MODELS.haiku,
      max_tokens: 1024,
      system:
        "You extract structured company facts from provided website text and headlines. Use ONLY the supplied text — never outside knowledge, and never guess. Omit any field you can't support from the text. For funding, capture round/amount/date only when explicitly stated. Awards and podcasts are titles/names mentioned in the text. Keep the executive list to real named people with their roles.",
      messages: [
        {
          role: "user",
          content: `COMPANY: ${opts.name} (${opts.domain})\n\nTEXT:\n${source}`,
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              description: { type: "string" },
              funding: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    round: { type: "string" },
                    amount: { type: "string" },
                    date: { type: "string" },
                  },
                },
              },
              executives: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    name: { type: "string" },
                    title: { type: "string" },
                  },
                  required: ["name"],
                },
              },
              awards: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: { title: { type: "string" } },
                  required: ["title"],
                },
              },
              podcasts: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: { title: { type: "string" } },
                  required: ["title"],
                },
              },
            },
            required: [],
          },
        },
      },
    });

    if (opts.accountId) {
      await logAIUsage({
        accountId: opts.accountId,
        feature: "intelligence.company",
        model: MODELS.haiku,
        usage: response.usage,
      });
    }

    const parsed = ExtractOutput.safeParse(response.parsed_output);
    if (!parsed.success) return null;
    const d = parsed.data;
    return {
      description: d.description,
      funding: d.funding?.length ? d.funding : undefined,
      executives: d.executives?.length ? d.executives : undefined,
      awards: d.awards?.length
        ? d.awards.map((a) => ({ title: a.title, url: "" }))
        : undefined,
      podcasts: d.podcasts?.length
        ? d.podcasts.map((p) => ({ title: p.title, url: "" }))
        : undefined,
    };
  } catch (err) {
    console.error("extractCompanyFacts failed:", err);
    return null;
  }
}
