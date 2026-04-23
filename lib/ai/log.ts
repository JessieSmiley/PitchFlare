import type Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

/**
 * Persists token usage for a single Claude API call so we can report on AI
 * spend per Account / Brand and measure prompt-cache hit rate.
 *
 * Pass the `usage` object straight off the response — the shape is the same
 * whether you got it from `messages.create`, `stream.finalMessage()`, or
 * `messages.parse()`.
 */
export async function logAIUsage({
  accountId,
  brandId,
  feature,
  model,
  usage,
}: {
  accountId: string;
  brandId?: string | null;
  feature: string;
  model: string;
  usage: Anthropic.Messages.Usage;
}): Promise<void> {
  try {
    await db.aiUsageLog.create({
      data: {
        accountId,
        brandId: brandId ?? null,
        feature,
        model,
        inputTokens: usage.input_tokens ?? 0,
        outputTokens: usage.output_tokens ?? 0,
        cacheReadTokens: usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
      },
    });
  } catch (err) {
    // Usage logging must never break the caller. A failed write here is a
    // reporting problem, not a product problem.
    console.error("logAIUsage failed:", err);
  }
}
