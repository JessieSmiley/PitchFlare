import type Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

/**
 * Serializable brand context consumed by every AI feature downstream of
 * Level-Set. Keep this shape STABLE and deterministic — it's the front of
 * every prompt we ship, so byte-level consistency is what keeps the Claude
 * prompt cache hot across ideation, drafting, analysis, and reporting.
 *
 * Rules:
 *  - Sort every array by a stable key (id, createdAt asc)
 *  - Omit empty strings; use `null` for "not set"
 *  - Never include timestamps, random IDs, or per-request state
 */
export type BrandContext = {
  brand: {
    id: string;
    name: string;
    description: string | null;
    website: string | null;
    category: string | null;
  };
  voice: {
    toneAttributes: string[];
    bannedWords: string[];
    alwaysDo: string | null;
    neverDo: string | null;
    styleNotes: string | null;
    sampleCorpus: string | null;
  };
  defaultBoilerplate: string | null;
  pillars: Array<{
    title: string;
    description: string | null;
    talkingPoints: string[];
  }>;
  spokespeople: Array<{
    name: string;
    title: string | null;
    bio: string | null;
  }>;
  products: Array<{
    name: string;
    description: string | null;
  }>;
  competitors: Array<{
    name: string;
    domain: string | null;
  }>;
  emulateExamples: Array<{
    title: string;
    url: string | null;
    description: string | null;
  }>;
};

/**
 * Assemble `BrandContext` for the given brand. Reads every Level-Set table
 * in parallel. Safe to call in server actions, route handlers, and Inngest
 * functions — it's just a Prisma fan-out.
 */
export async function getBrandContextForAI(
  brandId: string,
): Promise<BrandContext> {
  const [
    brand,
    voice,
    defaultBp,
    pillars,
    spokespeople,
    products,
    competitors,
    examples,
  ] = await Promise.all([
    db.brand.findUniqueOrThrow({
      where: { id: brandId },
      select: {
        id: true,
        name: true,
        description: true,
        website: true,
        category: true,
      },
    }),
    db.brandVoice.findUnique({ where: { brandId } }),
    db.brandBoilerplate.findFirst({
      where: { brandId, isDefault: true },
      select: { text: true },
    }),
    db.messagingPillar.findMany({
      where: { brandId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { title: true, description: true, talkingPoints: true },
    }),
    db.spokesperson.findMany({
      where: { brandId },
      orderBy: { createdAt: "asc" },
      select: { name: true, title: true, bio: true },
    }),
    db.product.findMany({
      where: { brandId },
      orderBy: { createdAt: "asc" },
      select: { name: true, description: true },
    }),
    db.competitor.findMany({
      where: { brandId },
      orderBy: { createdAt: "asc" },
      select: { name: true, domain: true },
    }),
    db.brandExample.findMany({
      where: { brandId, emulate: true },
      orderBy: { createdAt: "asc" },
      select: { title: true, url: true, description: true },
    }),
  ]);

  return {
    brand: {
      id: brand.id,
      name: brand.name,
      description: emptyToNull(brand.description),
      website: emptyToNull(brand.website),
      category: emptyToNull(brand.category),
    },
    voice: {
      toneAttributes: voice?.toneAttributes ?? [],
      bannedWords: voice?.bannedWords ?? [],
      alwaysDo: emptyToNull(voice?.alwaysDo),
      neverDo: emptyToNull(voice?.neverDo),
      styleNotes: emptyToNull(voice?.styleNotes),
      sampleCorpus: emptyToNull(voice?.sampleCorpus),
    },
    defaultBoilerplate: emptyToNull(defaultBp?.text),
    pillars,
    spokespeople,
    products,
    competitors,
    emulateExamples: examples,
  };
}

function emptyToNull(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length ? t : null;
}

/**
 * Render the brand context as a cacheable prompt block. We serialize with
 * `JSON.stringify(ctx, null, 2)` — the assemble function above returns
 * fields in a fixed order, so this produces identical bytes across calls.
 *
 * The resulting block sits at the very top of the `system` array in every
 * downstream AI call. With `cache_control: ephemeral` Claude treats it as
 * a cached prefix — first hit writes at ~1.25×, subsequent hits read at
 * ~0.1×. See shared/prompt-caching.md for placement rules.
 */
export function brandContextAsPromptBlock(
  ctx: BrandContext,
): Anthropic.Messages.TextBlockParam {
  const body = [
    "You are operating on behalf of the following brand. Every piece of",
    "output you produce must respect this voice, avoid banned words, and",
    "stay consistent with the brand's positioning.",
    "",
    "BRAND_CONTEXT (JSON):",
    JSON.stringify(ctx, null, 2),
  ].join("\n");

  return {
    type: "text",
    text: body,
    cache_control: { type: "ephemeral" },
  };
}
