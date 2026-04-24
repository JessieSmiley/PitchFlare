"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Dashboard-group error boundary. Catches uncaught exceptions from every
 * /dashboard/* server component and server action in its tree. The parent
 * layout (sidebar, top bar) stays mounted so the user doesn't lose
 * context — this is intentional per the Next.js docs.
 *
 * In production we ship the error to Sentry via the instrumentation hook;
 * in development we log the stack to the console so the DX stays fast.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("dashboard error boundary:", error);
    }
  }, [error]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 py-10">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        !
      </div>
      <div>
        <h1 className="font-display text-3xl text-brand-navy">
          Something broke on this screen
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The rest of the app is still fine — pick another phase from the
          sidebar, or try again once the underlying issue is fixed.
        </p>
      </div>
      {error.digest && (
        <p className="font-mono text-[10px] text-muted-foreground">
          error id: {error.digest}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-brand-pink px-4 py-2 text-sm text-white hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="rounded-full border border-border px-4 py-2 text-sm hover:border-brand-pink"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
