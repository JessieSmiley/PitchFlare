import type { DataProvider } from "./types";

/**
 * Apollo — stubbed. Connection + auth-check land in a later pass.
 * Included so the Integrations UI can list all four partners from the
 * registry without branching.
 */
export const apollo: DataProvider = {
  partner: "APOLLO",
  label: "Apollo",
  supports: () => false,
  authenticate: async () => ({ ok: false, error: "Apollo integration not yet implemented." }),
  enrich: async () => {
    throw new Error("Apollo integration not yet implemented.");
  },
};
