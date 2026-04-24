import type { BrandContext } from "@/lib/brand/context";

/**
 * Weighted completion score for the Level-Set checklist. 100% unlocks the
 * "Go to Strategize" CTA. Weights emphasize the fields that most improve
 * downstream AI output: voice, pillars, boilerplate.
 */
const WEIGHTS = {
  name: 5,
  description: 5,
  website: 5,
  category: 5,
  toneAttributes: 10,
  alwaysDo: 7,
  neverDo: 7,
  styleNotes: 6,
  defaultBoilerplate: 10,
  pillars: 15,
  spokespeople: 10,
  products: 5,
  competitors: 5,
  emulateExamples: 5,
} as const;

const TOTAL_WEIGHT = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);

export type CompletionResult = {
  score: number;
  filled: string[];
  missing: string[];
};

export function computeBrandCompletion(ctx: BrandContext): CompletionResult {
  const filled: string[] = [];
  const missing: string[] = [];
  let earned = 0;

  const credit = (key: keyof typeof WEIGHTS, present: boolean, label: string) => {
    if (present) {
      earned += WEIGHTS[key];
      filled.push(label);
    } else {
      missing.push(label);
    }
  };

  credit("name", Boolean(ctx.brand.name), "Brand name");
  credit("description", Boolean(ctx.brand.description), "Description");
  credit("website", Boolean(ctx.brand.website), "Website");
  credit("category", Boolean(ctx.brand.category), "Category");
  credit(
    "toneAttributes",
    ctx.voice.toneAttributes.length > 0,
    "Tone attributes",
  );
  credit("alwaysDo", Boolean(ctx.voice.alwaysDo), "What we always do");
  credit("neverDo", Boolean(ctx.voice.neverDo), "What we never do");
  credit("styleNotes", Boolean(ctx.voice.styleNotes), "Style notes");
  credit(
    "defaultBoilerplate",
    Boolean(ctx.defaultBoilerplate),
    "Default boilerplate",
  );
  credit("pillars", ctx.pillars.length >= 2, "At least 2 messaging pillars");
  credit(
    "spokespeople",
    ctx.spokespeople.length >= 1,
    "At least one spokesperson",
  );
  credit("products", ctx.products.length >= 1, "At least one product");
  credit(
    "competitors",
    ctx.competitors.length >= 2,
    "At least 2 competitors (for SoV)",
  );
  credit(
    "emulateExamples",
    ctx.emulateExamples.length >= 1,
    "At least one prior example",
  );

  const score = Math.round((earned / TOTAL_WEIGHT) * 100);
  return { score, filled, missing };
}
