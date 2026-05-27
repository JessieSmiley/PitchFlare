"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { load as loadHtml } from "cheerio";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import { anthropic, MODELS } from "@/lib/ai/anthropic";
import { logAIUsage } from "@/lib/ai/log";

// Shared success envelope.
type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

async function requireBrand(brandId: string) {
  const tenant = await requireTenant();
  const brand = await db.brand.findFirst({
    where: { id: brandId, accountId: tenant.account.id },
    select: { id: true },
  });
  if (!brand) throw new Error("Brand not found in current account.");
  return { tenant, brand };
}

// =============================================================================
// Brand basics
// =============================================================================

const BrandBasicsInput = z.object({
  brandId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).nullable().optional(),
  website: z.string().trim().url().nullable().optional().or(z.literal("")),
  category: z.string().trim().max(60).nullable().optional(),
  logoUrl: z.string().trim().url().nullable().optional().or(z.literal("")),
});

export async function updateBrandBasics(
  input: z.input<typeof BrandBasicsInput>,
): Promise<ActionResult> {
  const parsed = BrandBasicsInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  await requireBrand(parsed.data.brandId);

  await db.brand.update({
    where: { id: parsed.data.brandId },
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      website: parsed.data.website || null,
      category: parsed.data.category ?? null,
      logoUrl: parsed.data.logoUrl || null,
    },
  });

  revalidatePath("/dashboard/level-set");
  return { ok: true };
}

// =============================================================================
// Brand voice + standards
// =============================================================================

const BrandVoiceInput = z.object({
  brandId: z.string().min(1),
  toneAttributes: z.array(z.string().trim().min(1)).max(20).optional(),
  bannedWords: z.array(z.string().trim().min(1)).max(50).optional(),
  alwaysDo: z.string().trim().max(2000).nullable().optional(),
  neverDo: z.string().trim().max(2000).nullable().optional(),
  styleNotes: z.string().trim().max(5000).nullable().optional(),
  sampleCorpus: z.string().trim().max(20000).nullable().optional(),
});

export async function updateBrandVoice(
  input: z.input<typeof BrandVoiceInput>,
): Promise<ActionResult> {
  const parsed = BrandVoiceInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  await requireBrand(parsed.data.brandId);

  const { brandId, ...rest } = parsed.data;

  await db.brandVoice.upsert({
    where: { brandId },
    create: {
      brandId,
      toneAttributes: rest.toneAttributes ?? [],
      bannedWords: rest.bannedWords ?? [],
      alwaysDo: rest.alwaysDo ?? null,
      neverDo: rest.neverDo ?? null,
      styleNotes: rest.styleNotes ?? null,
      sampleCorpus: rest.sampleCorpus ?? null,
    },
    update: {
      toneAttributes: rest.toneAttributes,
      bannedWords: rest.bannedWords,
      alwaysDo: rest.alwaysDo,
      neverDo: rest.neverDo,
      styleNotes: rest.styleNotes,
      sampleCorpus: rest.sampleCorpus,
    },
  });

  revalidatePath("/dashboard/level-set");
  return { ok: true };
}

// =============================================================================
// Default boilerplate
// =============================================================================

const BoilerplateInput = z.object({
  brandId: z.string().min(1),
  text: z.string().trim().max(1500),
});

export async function updateDefaultBoilerplate(
  input: z.input<typeof BoilerplateInput>,
): Promise<ActionResult> {
  const parsed = BoilerplateInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  await requireBrand(parsed.data.brandId);

  const existing = await db.brandBoilerplate.findFirst({
    where: { brandId: parsed.data.brandId, isDefault: true },
    select: { id: true },
  });

  if (existing) {
    await db.brandBoilerplate.update({
      where: { id: existing.id },
      data: { text: parsed.data.text, label: "Default" },
    });
  } else if (parsed.data.text.length > 0) {
    await db.brandBoilerplate.create({
      data: {
        brandId: parsed.data.brandId,
        label: "Default",
        text: parsed.data.text,
        isDefault: true,
      },
    });
  }

  revalidatePath("/dashboard/level-set");
  return { ok: true };
}

// =============================================================================
// Brand examples (CRUD)
// =============================================================================

const ExampleUpsertInput = z.object({
  brandId: z.string().min(1),
  id: z.string().optional(),
  title: z.string().trim().min(1).max(120),
  url: z.string().trim().url().nullable().optional().or(z.literal("")),
  description: z.string().trim().max(1000).nullable().optional(),
  emulate: z.boolean().default(true),
});

export async function upsertBrandExample(
  input: z.input<typeof ExampleUpsertInput>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = ExampleUpsertInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  await requireBrand(parsed.data.brandId);

  const data = {
    title: parsed.data.title,
    url: parsed.data.url || null,
    description: parsed.data.description ?? null,
    emulate: parsed.data.emulate,
  };

  const row = parsed.data.id
    ? await db.brandExample.update({
        where: { id: parsed.data.id },
        data,
        select: { id: true },
      })
    : await db.brandExample.create({
        data: { ...data, brandId: parsed.data.brandId },
        select: { id: true },
      });

  revalidatePath("/dashboard/level-set");
  return { ok: true, id: row.id };
}

export async function deleteBrandExample(
  input: { brandId: string; id: string },
): Promise<ActionResult> {
  await requireBrand(input.brandId);
  await db.brandExample.delete({ where: { id: input.id } });
  revalidatePath("/dashboard/level-set");
  return { ok: true };
}

// =============================================================================
// Messaging pillars (CRUD)
// =============================================================================

const PillarUpsertInput = z.object({
  brandId: z.string().min(1),
  id: z.string().optional(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  talkingPoints: z.array(z.string().trim().min(1)).max(20).optional(),
});

export async function upsertPillar(
  input: z.input<typeof PillarUpsertInput>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = PillarUpsertInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  await requireBrand(parsed.data.brandId);

  const data = {
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    talkingPoints: parsed.data.talkingPoints ?? [],
  };

  const row = parsed.data.id
    ? await db.messagingPillar.update({
        where: { id: parsed.data.id },
        data,
        select: { id: true },
      })
    : await db.messagingPillar.create({
        data: { ...data, brandId: parsed.data.brandId },
        select: { id: true },
      });

  revalidatePath("/dashboard/level-set");
  return { ok: true, id: row.id };
}

export async function deletePillar(input: {
  brandId: string;
  id: string;
}): Promise<ActionResult> {
  await requireBrand(input.brandId);
  await db.messagingPillar.delete({ where: { id: input.id } });
  revalidatePath("/dashboard/level-set");
  return { ok: true };
}

// =============================================================================
// Spokespeople (CRUD)
// =============================================================================

const SpokespersonUpsertInput = z.object({
  brandId: z.string().min(1),
  id: z.string().optional(),
  name: z.string().trim().min(1).max(120),
  title: z.string().trim().max(120).nullable().optional(),
  bio: z.string().trim().max(2000).nullable().optional(),
});

export async function upsertSpokesperson(
  input: z.input<typeof SpokespersonUpsertInput>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = SpokespersonUpsertInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  await requireBrand(parsed.data.brandId);

  const data = {
    name: parsed.data.name,
    title: parsed.data.title ?? null,
    bio: parsed.data.bio ?? null,
  };

  const row = parsed.data.id
    ? await db.spokesperson.update({
        where: { id: parsed.data.id },
        data,
        select: { id: true },
      })
    : await db.spokesperson.create({
        data: { ...data, brandId: parsed.data.brandId },
        select: { id: true },
      });

  revalidatePath("/dashboard/level-set");
  return { ok: true, id: row.id };
}

export async function deleteSpokesperson(input: {
  brandId: string;
  id: string;
}): Promise<ActionResult> {
  await requireBrand(input.brandId);
  await db.spokesperson.delete({ where: { id: input.id } });
  revalidatePath("/dashboard/level-set");
  return { ok: true };
}

// =============================================================================
// Products (CRUD)
// =============================================================================

const ProductUpsertInput = z.object({
  brandId: z.string().min(1),
  id: z.string().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
});

export async function upsertProduct(
  input: z.input<typeof ProductUpsertInput>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = ProductUpsertInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  await requireBrand(parsed.data.brandId);

  const data = {
    name: parsed.data.name,
    description: parsed.data.description ?? null,
  };

  const row = parsed.data.id
    ? await db.product.update({
        where: { id: parsed.data.id },
        data,
        select: { id: true },
      })
    : await db.product.create({
        data: { ...data, brandId: parsed.data.brandId },
        select: { id: true },
      });

  revalidatePath("/dashboard/level-set");
  return { ok: true, id: row.id };
}

export async function deleteProduct(input: {
  brandId: string;
  id: string;
}): Promise<ActionResult> {
  await requireBrand(input.brandId);
  await db.product.delete({ where: { id: input.id } });
  revalidatePath("/dashboard/level-set");
  return { ok: true };
}

// =============================================================================
// Competitors (CRUD)
// =============================================================================

const CompetitorUpsertInput = z.object({
  brandId: z.string().min(1),
  id: z.string().optional(),
  name: z.string().trim().min(1).max(120),
  domain: z.string().trim().max(200).nullable().optional(),
});

export async function upsertCompetitor(
  input: z.input<typeof CompetitorUpsertInput>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = CompetitorUpsertInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  await requireBrand(parsed.data.brandId);

  const data = {
    name: parsed.data.name,
    domain: parsed.data.domain ?? null,
  };

  const row = parsed.data.id
    ? await db.competitor.update({
        where: { id: parsed.data.id },
        data,
        select: { id: true },
      })
    : await db.competitor.create({
        data: { ...data, brandId: parsed.data.brandId },
        select: { id: true },
      });

  revalidatePath("/dashboard/level-set");
  return { ok: true, id: row.id };
}

export async function deleteCompetitor(input: {
  brandId: string;
  id: string;
}): Promise<ActionResult> {
  await requireBrand(input.brandId);
  await db.competitor.delete({ where: { id: input.id } });
  revalidatePath("/dashboard/level-set");
  return { ok: true };
}

// =============================================================================
// Website voice analysis (AI)
// =============================================================================

const VoiceFromWebsiteOutput = z.object({
  toneAttributes: z.array(z.string()).max(8),
  alwaysDo: z.string(),
  neverDo: z.string(),
  styleNotes: z.string(),
  // Optional extras if Claude finds them — we don't require them.
  suggestedBannedWords: z.array(z.string()).optional(),
});
export type VoiceFromWebsite = z.infer<typeof VoiceFromWebsiteOutput>;

const VoiceFromWebsiteInput = z.object({
  brandId: z.string().min(1),
  url: z.string().trim().url(),
});

/**
 * Fetch a brand's website, strip to readable text, and ask Claude Haiku
 * to extract a draft voice profile. Returns the structured suggestion —
 * the user accepts or edits before `updateBrandVoice` persists it.
 *
 * We use Haiku 4.5 here because this is a simple extraction task and
 * responses stream back fast; no strategic reasoning needed.
 */
export async function analyzeWebsiteForVoice(
  input: z.input<typeof VoiceFromWebsiteInput>,
): Promise<ActionResult<{ voice: VoiceFromWebsite }>> {
  const parsed = VoiceFromWebsiteInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid URL" };
  }
  const { tenant } = await requireBrand(parsed.data.brandId);

  let readableText: string;
  try {
    readableText = await fetchReadableText(parsed.data.url);
  } catch (e) {
    return {
      ok: false,
      error: `Could not fetch ${parsed.data.url}. ${e instanceof Error ? e.message : ""}`.trim(),
    };
  }
  if (readableText.length < 100) {
    return {
      ok: false,
      error: `Couldn't extract enough text from that page (got ${readableText.length} chars). The site may be rendered with JavaScript — try a deeper page like /about.`,
    };
  }

  // Claude Messages API, structured output constrained to VoiceFromWebsite.
  try {
    const response = await anthropic.messages.parse({
      model: MODELS.haiku,
      max_tokens: 1024,
      system: [
        "You analyze marketing websites to extract brand voice profiles.",
        "Keep each field short and concrete — avoid adjectives that could apply",
        "to any brand. Base every field strictly on the provided text; do not",
        "speculate about things that aren't supported by it.",
      ].join(" "),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Website text (truncated to ~8000 chars):\n\n${readableText.slice(0, 8000)}`,
            },
          ],
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              toneAttributes: {
                type: "array",
                items: { type: "string" },
                description: "3-5 single-word tone descriptors.",
              },
              alwaysDo: {
                type: "string",
                description: "One sentence on what the brand consistently does.",
              },
              neverDo: {
                type: "string",
                description: "One sentence on what the brand avoids.",
              },
              styleNotes: {
                type: "string",
                description: "2-3 sentences on sentence length, formatting, and rhetorical devices.",
              },
              suggestedBannedWords: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["toneAttributes", "alwaysDo", "neverDo", "styleNotes"],
          },
        },
      },
    });

    await logAIUsage({
      accountId: tenant.account.id,
      brandId: parsed.data.brandId,
      feature: "level_set.analyze_website_voice",
      model: MODELS.haiku,
      usage: response.usage,
    });

    const parsedOutput = VoiceFromWebsiteOutput.safeParse(
      response.parsed_output,
    );
    if (!parsedOutput.success) {
      return { ok: false, error: "AI response didn't match the expected shape." };
    }
    return { ok: true, voice: parsedOutput.data };
  } catch (err) {
    console.error("analyzeWebsiteForVoice failed:", err);
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();
    if (
      lower.includes("api key") ||
      lower.includes("401") ||
      lower.includes("403") ||
      lower.includes("unauthorized")
    ) {
      return {
        ok: false,
        error: "AI analysis failed: the Anthropic API key is missing or invalid. Set ANTHROPIC_API_KEY and try again.",
      };
    }
    return {
      ok: false,
      error: `AI analysis failed: ${msg}`,
    };
  }
}

async function fetchReadableText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; PitchFlare/1.0; +https://pitchflare.com)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  const $ = loadHtml(html);

  // Pull metadata first — these survive even on JS-rendered SPAs because they
  // sit in the static <head>.
  const parts: string[] = [];
  const title = $("title").first().text().trim();
  if (title) parts.push(title);
  const metaDesc = $('meta[name="description"]').attr("content")?.trim();
  if (metaDesc) parts.push(metaDesc);
  const ogDesc = $('meta[property="og:description"]').attr("content")?.trim();
  if (ogDesc && ogDesc !== metaDesc) parts.push(ogDesc);
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  if (ogTitle && ogTitle !== title) parts.push(ogTitle);

  // Strip the obvious noise from the body.
  $("script, style, noscript, svg, iframe, nav, footer, header, form").remove();

  // Prefer headings and paragraph text over the whole body — gives us cleaner
  // signal on marketing sites that wrap everything in nested divs.
  $("h1, h2, h3, p, li").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t.length > 0) parts.push(t);
  });

  let text = parts.join(" ").replace(/\s+/g, " ").trim();
  if (text.length < 100) {
    // Last resort: take whatever's in <body>.
    text = $("body").text().replace(/\s+/g, " ").trim();
  }
  return text;
}
