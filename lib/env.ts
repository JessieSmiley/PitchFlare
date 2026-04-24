/**
 * Centralized env access. Throws at read-time if required vars are missing in
 * server contexts so failures surface during requests, not deep inside SDKs.
 */

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env = {
  get DATABASE_URL() {
    return required("DATABASE_URL");
  },
  get ANTHROPIC_API_KEY() {
    return required("ANTHROPIC_API_KEY");
  },
  get PF_ENCRYPTION_KEY() {
    return required("PF_ENCRYPTION_KEY");
  },
  get STRIPE_SECRET_KEY() {
    return required("STRIPE_SECRET_KEY");
  },
  get STRIPE_WEBHOOK_SECRET() {
    return required("STRIPE_WEBHOOK_SECRET");
  },
  get RESEND_API_KEY() {
    return required("RESEND_API_KEY");
  },
  get APP_URL() {
    return optional("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  },

  // Claude models (safe defaults per SPEC.md §4.3)
  CLAUDE_OPUS: optional("CLAUDE_MODEL_OPUS", "claude-opus-4-7"),
  CLAUDE_SONNET: optional("CLAUDE_MODEL_SONNET", "claude-sonnet-4-6"),
  CLAUDE_HAIKU: optional("CLAUDE_MODEL_HAIKU", "claude-haiku-4-5-20251001"),
};
