/**
 * Next.js instrumentation hook. Runs once at server boot on every runtime
 * (Node, Edge). We lazily initialize Sentry here so SENTRY_DSN can be
 * unset in development without blowing up startup.
 *
 * If @sentry/nextjs isn't installed (it isn't in v1 dependencies), the
 * dynamic import returns null and we silently skip — that keeps the
 * server bootable while the package is being added.
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config").catch(() => null);
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config").catch(() => null);
  }
}

/**
 * Forward every server-side error to Sentry. Called automatically by
 * Next.js when a request handler throws.
 */
export async function onRequestError(
  ...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>
) {
  if (!process.env.SENTRY_DSN) return;
  try {
    const Sentry = await import("@sentry/nextjs").catch(() => null);
    if (!Sentry) return;
    Sentry.captureRequestError(...args);
  } catch {
    // Never let instrumentation break a request path.
  }
}
