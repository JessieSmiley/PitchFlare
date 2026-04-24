import type { DataProvider } from "./types";

/**
 * Podchaser — stubbed. Podcast-specific enrichment (show contact email,
 * host info, episode stats) slots in here once the real integration
 * lands.
 */
export const podchaser: DataProvider = {
  partner: "PODCHASER",
  label: "Podchaser",
  supports: () => false,
  authenticate: async () => ({ ok: false, error: "Podchaser integration not yet implemented." }),
  enrich: async () => {
    throw new Error("Podchaser integration not yet implemented.");
  },
};
