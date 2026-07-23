"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addContactsToList } from "@/lib/contacts/list-actions";

export type ListOption = { id: string; name: string };

/**
 * Reusable "add these contacts to a list" dialog. Used from the contact
 * drawer (one contact), the directory bulk-select bar (many), and the
 * discovery results panel (freshly-added contacts). The caller supplies the
 * contact ids and the brand's existing lists; the modal handles the
 * existing-vs-new choice and the server round-trip.
 */
export function AddToListModal({
  contactIds,
  lists,
  campaignId = null,
  title,
  onClose,
}: {
  contactIds: string[];
  lists: ListOption[];
  campaignId?: string | null;
  title?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"existing" | "new">(
    lists.length > 0 ? "existing" : "new",
  );
  const [listId, setListId] = useState(lists[0]?.id ?? "");
  const [newName, setNewName] = useState("");
  const [result, setResult] = useState<{
    listId: string;
    listName: string;
    added: number;
  } | null>(null);

  const count = contactIds.length;
  const heading =
    title ?? `Add ${count} contact${count === 1 ? "" : "s"} to a list`;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await addContactsToList(
        mode === "existing"
          ? { contactIds, mediaListId: listId }
          : { contactIds, newListName: newName.trim(), campaignId },
      );
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult({ listId: res.listId, listName: res.listName, added: res.added });
      router.refresh();
    });
  }

  const canSubmit =
    mode === "existing" ? Boolean(listId) : newName.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-brand-navy/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={heading}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {result ? (
          <div>
            <h2 className="font-display text-xl text-brand-navy">
              Added to {result.listName}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {result.added > 0
                ? `${result.added} contact${result.added === 1 ? "" : "s"} added.`
                : "Those contacts were already on the list."}
              {result.added < count && result.added > 0
                ? ` ${count - result.added} were already there.`
                : ""}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border px-3 py-2 text-sm text-brand-navy hover:border-brand-pink"
              >
                Done
              </button>
              <Link
                href={`/dashboard/lists/${result.listId}`}
                onClick={onClose}
                className="rounded-lg bg-brand-pink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                View list →
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-display text-xl text-brand-navy">{heading}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="text-muted-foreground hover:text-brand-navy"
              >
                ✕
              </button>
            </div>

            {lists.length > 0 && (
              <div className="mt-4 flex gap-1 rounded-lg bg-muted p-0.5 text-xs">
                {(["existing", "new"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`flex-1 rounded-md px-3 py-1.5 ${
                      mode === m
                        ? "bg-white font-medium text-brand-navy"
                        : "text-muted-foreground"
                    }`}
                  >
                    {m === "existing" ? "Existing list" : "New list"}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4">
              {mode === "existing" ? (
                <label className="block text-sm font-medium text-brand-navy">
                  List
                  <select
                    value={listId}
                    onChange={(e) => setListId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                  >
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="block text-sm font-medium text-brand-navy">
                  New list name
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    maxLength={120}
                    placeholder="e.g. Cybersecurity press — Tier 1"
                    className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                  />
                </label>
              )}
            </div>

            {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border px-3 py-2 text-sm text-brand-navy hover:border-brand-pink"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || !canSubmit}
                className="rounded-lg bg-brand-pink px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {pending
                  ? "Adding…"
                  : mode === "existing"
                    ? "Add to list"
                    : "Create & add"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
