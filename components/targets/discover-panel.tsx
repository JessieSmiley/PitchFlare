"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDiscoveredContacts } from "@/lib/contacts/discover";
import type { DiscoveredPerson } from "@/lib/providers/types";

export function DiscoverPanel({
  providerLabel,
  query,
  outletName,
  people,
  onClose,
}: {
  providerLabel: string;
  query: string;
  outletName?: string;
  people: DiscoveredPerson[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  // Pre-select every candidate that came with an email — those are the
  // immediately useful ones to add.
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(people.map((_, i) => i).filter((i) => people[i].email)),
  );

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function addSelected() {
    if (selected.size === 0) return;
    setMessage(null);
    const chosen = [...selected].map((i) => people[i]);
    startSave(async () => {
      const res = await addDiscoveredContacts({ people: chosen });
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      const parts = [`Added ${res.added} contact${res.added === 1 ? "" : "s"}`];
      if (res.skipped > 0) parts.push(`${res.skipped} already in directory`);
      setMessage(`${parts.join(" · ")}.`);
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/20"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-lg flex-col border-l border-border bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between border-b border-border p-6">
          <div>
            <h2 className="font-display text-2xl text-brand-navy">
              {providerLabel} results
            </h2>
            <p className="text-xs text-muted-foreground">
              {people.length} found for &ldquo;{query}&rdquo;
              {outletName && outletName.toLowerCase() !== query.toLowerCase()
                ? ` · ${outletName}`
                : ""}
              . Uses your {providerLabel} credits.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-2 py-1 text-xs"
          >
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {people.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No people found. Try the outlet&apos;s full name or its domain.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {people.map((p, i) => (
                <li key={`${p.email ?? p.fullName}-${i}`}>
                  <label className="flex cursor-pointer items-start gap-3 p-4 hover:bg-muted/50">
                    <input
                      type="checkbox"
                      checked={selected.has(i)}
                      onChange={() => toggle(i)}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-brand-navy">
                          {p.fullName}
                        </span>
                        {typeof p.confidence === "number" && (
                          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                            {p.confidence}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {[p.title, p.outletName].filter(Boolean).join(" · ") ||
                          "—"}
                      </div>
                      <div className="truncate font-mono text-xs text-brand-navy">
                        {p.email ?? "no email found"}
                      </div>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border p-4">
          <span className="text-xs text-muted-foreground">
            {message ?? `${selected.size} selected`}
          </span>
          <button
            type="button"
            onClick={addSelected}
            disabled={saving || selected.size === 0}
            className="rounded-lg bg-brand-pink px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {saving ? "Adding…" : "Add selected"}
          </button>
        </footer>
      </aside>
    </div>
  );
}
