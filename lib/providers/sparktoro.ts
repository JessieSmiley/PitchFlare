import type { DataProvider } from "./types";

/**
 * SparkToro — stubbed. Audience-intelligence lookup for influencers slots
 * in here.
 */
export const sparktoro: DataProvider = {
  partner: "SPARKTORO",
  label: "SparkToro",
  supports: () => false,
  authenticate: async () => ({ ok: false, error: "SparkToro integration not yet implemented." }),
  enrich: async () => {
    throw new Error("SparkToro integration not yet implemented.");
  },
};
