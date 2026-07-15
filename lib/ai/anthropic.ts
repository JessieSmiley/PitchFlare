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

/**
 * Translate an Anthropic API failure into a message safe to show end users.
 * Raw API errors are JSON dumps with request IDs — useless to a PR
 * consultant and they leak infrastructure detail.
 */
export function describeAIError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  if (err instanceof Anthropic.APIError) {
    if (raw.includes("credit balance is too low")) {
      return "PitchFlare's AI provider account is out of credits. An administrator needs to top up API credits in the Anthropic Console (Plans & Billing) before AI features will work again.";
    }
    if (err.status === 401 || err.status === 403) {
      return "PitchFlare's AI provider API key was rejected. An administrator needs to check the ANTHROPIC_API_KEY configuration.";
    }
    if (err.status === 429) {
      return "The AI service is rate-limited right now. Wait a minute and try again.";
    }
    if (err.status !== undefined && err.status >= 500) {
      return "The AI service is temporarily unavailable. Try again in a few moments.";
    }
  }

  return raw;
}
