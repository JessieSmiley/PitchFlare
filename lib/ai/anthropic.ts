import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

/**
 * Singleton Anthropic client. Reused across requests in dev (Next.js HMR
 * would otherwise spawn a fresh client every save).
 */
const globalForAnthropic = globalThis as unknown as {
  anthropic: Anthropic | undefined;
};

export const anthropic =
  globalForAnthropic.anthropic ?? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

if (process.env.NODE_ENV !== "production") {
  globalForAnthropic.anthropic = anthropic;
}

/**
 * Which Claude to use for which feature.
 *
 * Routing per SPEC.md §4.3:
 *   Opus    — deep strategy work (Ideation Station, status briefs)
 *   Sonnet  — default drafting + analysis (pitches, releases, coverage triage)
 *   Haiku   — cheap transforms (subject lines, voice extraction, normalization)
 */
export const MODELS = {
  opus: env.CLAUDE_OPUS,
  sonnet: env.CLAUDE_SONNET,
  haiku: env.CLAUDE_HAIKU,
} as const;

export type ModelTier = keyof typeof MODELS;
