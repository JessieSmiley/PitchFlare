"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Campaign = { id: string; title: string };

/**
 * "Pitch this list" — sends the list into the pitch composer. A
 * campaign-attached list goes straight there; a standalone list first asks
 * which campaign to draft under (pitches always belong to a campaign).
 */
export function PitchListButton({
  listId,
  campaign,
  campaigns,
}: {
  listId: string;
  campaign: Campaign | null;
  campaigns: Campaign[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (campaign) {
    return (
      <Link
        href={`/dashboard/draft/pitches?listId=${listId}`}
        className="rounded-lg bg-brand-pink px-4 py-2 text-sm font-medium text-white hover:bg-brand-pink-deep"
      >
        Pitch this list →
      </Link>
    );
  }

  if (campaigns.length === 0) {
    return (
      <span
        title="Create a campaign first — pitches belong to a campaign."
        className="cursor-not-allowed rounded-lg bg-brand-pink/50 px-4 py-2 text-sm font-medium text-white"
      >
        Pitch this list →
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg bg-brand-pink px-4 py-2 text-sm font-medium text-white hover:bg-brand-pink-deep"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Pitch this list ▾
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-border bg-white p-1 shadow-lg">
          <p className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            Draft under campaign
          </p>
          {campaigns.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() =>
                router.push(
                  `/dashboard/draft/pitches?listId=${listId}&campaignId=${c.id}`,
                )
              }
              className="block w-full truncate rounded-md px-2 py-1.5 text-left text-sm text-brand-navy hover:bg-brand-mist"
            >
              {c.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
