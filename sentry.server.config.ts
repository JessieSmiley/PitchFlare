/**
 * Sentry server-runtime config. Only loaded from `instrumentation.ts`
 * when SENTRY_DSN is set. Add `@sentry/nextjs` to dependencies when
 * you're ready to wire Sentry live — the import here is optional so the
 * server still boots without it.
 */
async function init() {
  const Sentry = await import("@sentry/nextjs").catch(() => null);
  if (!Sentry) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}
init();

export {};
