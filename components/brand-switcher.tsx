"use client";

import { useState, useTransition } from "react";
import { switchBrandAction } from "@/lib/auth/actions";
import { useRouter } from "next/navigation";

export type BrandSwitcherOption = {
  id: string;
  name: string;
  slug: string;
};

/**
 * Top-bar brand switcher. Writes the active brand to a cookie via server
 * action, then refreshes the route so every component re-reads the tenant.
 */
export function BrandSwitcher({
  current,
  options,
}: {
  current: BrandSwitcherOption | null;
  options: BrandSwitcherOption[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function select(id: string) {
    if (id === current?.id) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      const res = await switchBrandAction(id);
      setOpen(false);
      if (res.ok) router.refresh();
      else alert(res.error);
    });
  }

  if (!current && options.length === 0) {
    return (
      <a
        href="/onboarding/brand"
        className="text-sm text-brand-pink hover:underline"
      >
        Create your first brand →
      </a>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isPending}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-1.5 text-sm text-brand-navy hover:border-brand-pink"
      >
        <span className="h-2 w-2 rounded-full bg-brand-pink" aria-hidden />
        <span className="font-medium">{current?.name ?? "Pick a brand"}</span>
        <span className="text-muted-foreground" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 z-20 mt-1 w-64 rounded-md border border-border bg-white py-1 shadow-lg"
        >
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="menuitem"
              onClick={() => select(o.id)}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted ${
                o.id === current?.id ? "text-brand-pink" : "text-brand-navy"
              }`}
            >
              <span>{o.name}</span>
              {o.id === current?.id && (
                <span className="text-xs" aria-label="current">
                  ✓
                </span>
              )}
            </button>
          ))}
          <div className="my-1 h-px bg-border" />
          <a
            href="/onboarding/brand"
            className="block px-3 py-2 text-sm text-brand-pink hover:bg-muted"
          >
            + New brand
          </a>
        </div>
      )}
    </div>
  );
}
