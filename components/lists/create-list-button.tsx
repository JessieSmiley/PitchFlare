"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMediaList } from "@/lib/contacts/list-actions";

type Campaign = { id: string; title: string };

/** Header button + modal for creating an empty media list. */
export function CreateListButton({ campaigns }: { campaigns: Campaign[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [campaignId, setCampaignId] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await createMediaList({
        name: name.trim(),
        description: description.trim(),
        campaignId: campaignId || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.push(`/dashboard/lists/${res.listId}`);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand-pink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-pink-deep"
      >
        + New list
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Create a list"
          onClick={() => setOpen(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={submit}
            className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-display text-xl text-brand-navy">
                Create a list
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-muted-foreground hover:text-brand-navy"
              >
                ✕
              </button>
            </div>

            <label className="mt-4 block text-sm font-medium text-brand-navy">
              List name
              <input
                autoFocus
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Cybersecurity press — Tier 1"
                className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              />
            </label>

            <label className="mt-3 block text-sm font-medium text-brand-navy">
              Description <span className="text-muted-foreground">(optional)</span>
              <input
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              />
            </label>

            <label className="mt-3 block text-sm font-medium text-brand-navy">
              Attach to campaign{" "}
              <span className="text-muted-foreground">(optional)</span>
              <select
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              >
                <option value="">Standalone (no campaign)</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>

            {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-border px-3 py-2 text-sm text-brand-navy hover:border-brand-pink"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || !name.trim()}
                className="rounded-lg bg-brand-pink px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {pending ? "Creating…" : "Create list"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
