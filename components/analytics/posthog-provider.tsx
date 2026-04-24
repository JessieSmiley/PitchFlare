"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Lightweight PostHog init. We lazy-load the browser SDK on the first
 * render so anonymous landing visitors don't pay the bundle cost, and we
 * no-op when NEXT_PUBLIC_POSTHOG_KEY is missing (local dev).
 *
 * Tracks page views on route change. Identify() happens via Clerk's user
 * id on first authenticated render — we don't reach into Clerk here to
 * keep this file tree-shakeable; you can attach identify elsewhere if
 * you want user-keyed analytics.
 */
export function PosthogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || typeof window === "undefined") return;
    // @ts-expect-error — window.posthog is installed by the dynamic import below.
    if (window.posthog) return;

    import("posthog-js")
      .then((mod) => {
        const posthog = mod.default;
        posthog.init(key, {
          api_host:
            process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
          capture_pageview: false, // we fire our own below
          loaded: () => {
            // @ts-expect-error — stash for the pathname effect.
            window.posthog = posthog;
          },
        });
      })
      .catch(() => {
        // Never block the app on analytics.
      });
  }, []);

  useEffect(() => {
    // @ts-expect-error — posthog is attached asynchronously.
    const posthog = typeof window !== "undefined" ? window.posthog : null;
    if (!posthog) return;
    const qs = searchParams.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return <>{children}</>;
}
