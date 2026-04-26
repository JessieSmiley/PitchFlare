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
