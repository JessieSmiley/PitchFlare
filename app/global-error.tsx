"use client";

/**
 * Root error boundary. Only fires when the app's root layout itself
 * crashes — in practice this means Clerk misconfig, Prisma connect
 * failures on boot, or env-var gates in lib/env throwing before any
 * page component ran. Must provide its own <html>/<body>.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem", color: "#1a2744" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <div
            style={{
              height: 4,
              width: 48,
              background: "#D4537E",
              marginBottom: 16,
            }}
          />
          <h1 style={{ fontSize: 28, margin: "0 0 8px", fontFamily: "Georgia, serif" }}>
            PitchFlare couldn&apos;t boot this page.
          </h1>
          <p style={{ color: "#6b7280", fontSize: 14 }}>
            Usually this is a missing env var (Clerk, Anthropic, database) or
            a bad build. Check the server logs. If you&apos;re self-hosting,
            run <code>pnpm db:deploy</code> to apply migrations.
          </p>
          {error.digest && (
            <p style={{ fontFamily: "monospace", fontSize: 11, color: "#9ca3af" }}>
              error id: {error.digest}
            </p>
          )}
          <a
            href="/"
            style={{
              display: "inline-block",
              marginTop: 16,
              background: "#D4537E",
              color: "white",
              padding: "8px 16px",
              borderRadius: 9999,
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            Home
          </a>
        </div>
      </body>
    </html>
  );
}
