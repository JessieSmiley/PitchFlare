import type { DataProvider, EnrichResult, LookupInput } from "./types";

/**
 * Uniform enrichment entry point across sync and async providers. Sync
 * providers (Hunter, Apollo, Prospeo) resolve in one call; async providers
 * (Dropcontact) submit a job and are polled here until done or the budget
 * runs out. Callers never have to branch on the provider's protocol.
 *
 * The default 25s budget suits an interactive, user-initiated single-contact
 * enrich. Bulk/discovery callers should pass a tighter `timeoutMs` (or skip
 * async providers entirely) so one slow lookup can't stall a whole list.
 */
export async function runProviderEnrich(
  provider: DataProvider,
  apiKey: string,
  input: LookupInput,
  opts: { timeoutMs?: number; pollIntervalMs?: number } = {},
): Promise<EnrichResult> {
  if (provider.enrichIsAsync && provider.submitEnrich && provider.pollEnrich) {
    const timeoutMs = opts.timeoutMs ?? 25_000;
    const interval = opts.pollIntervalMs ?? 3_000;

    const { jobId } = await provider.submitEnrich(apiKey, input);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await sleep(interval);
      const poll = await provider.pollEnrich(apiKey, jobId);
      if (poll.status === "done") return poll.result;
      if (poll.status === "error") throw new Error(poll.error);
      // status === "pending" → keep polling until the deadline.
    }
    throw new Error(`${provider.label} enrichment timed out.`);
  }

  return provider.enrich(apiKey, input);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
