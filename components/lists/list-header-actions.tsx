"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMediaList, renameMediaList } from "@/lib/contacts/list-actions";

/** Rename / delete controls for a media list, shown in the detail header. */
export function ListHeaderActions({
  listId,
  name,
  description,
}: {
  listId: string;
  name: string;
  description: string | null;
}) {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draftName, setDraftName] = useState(name);
  const [draftDesc, setDraftDesc] = useState(description ?? "");

  function saveRename(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await renameMediaList({
        mediaListId: listId,
        name: draftName.trim(),
        description: draftDesc.trim(),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEditing(false);
      setMenu(false);
      router.refresh();
    });
  }

  function doDelete() {
    setError(null);
    start(async () => {
      const res = await deleteMediaList({ mediaListId: listId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/dashboard/lists");
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenu((m) => !m)}
        className="rounded-lg border border-border px-3 py-2 text-sm text-brand-navy hover:border-brand-pink"
        aria-haspopup="menu"
        aria-expanded={menu}
      >
        Manage ▾
      </button>

      {menu && !editing && !confirmDelete && (
        <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-border bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="block w-full px-3 py-1.5 text-left text-sm text-brand-navy hover:bg-brand-mist"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="block w-full px-3 py-1.5 text-left text-sm text-destructive hover:bg-brand-mist"
          >
            Delete list
          </button>
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Rename list"
          onClick={() => setEditing(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={saveRename}
            className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-xl"
          >
            <h2 className="font-display text-xl text-brand-navy">Rename list</h2>
            <label className="mt-4 block text-sm font-medium text-brand-navy">
              Name
              <input
                autoFocus
                required
                maxLength={120}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="mt-3 block text-sm font-medium text-brand-navy">
              Description{" "}
              <span className="text-muted-foreground">(optional)</span>
              <input
                maxLength={500}
                value={draftDesc}
                onChange={(e) => setDraftDesc(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              />
            </label>
            {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg border border-border px-3 py-2 text-sm text-brand-navy hover:border-brand-pink"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || !draftName.trim()}
                className="rounded-lg bg-brand-pink px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Delete list"
          onClick={() => setConfirmDelete(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-xl"
          >
            <h2 className="font-display text-xl text-brand-navy">
              Delete &ldquo;{name}&rdquo;?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This removes the list. The contacts themselves stay in your
              directory.
            </p>
            {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-border px-3 py-2 text-sm text-brand-navy hover:border-brand-pink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={doDelete}
                disabled={pending}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {pending ? "Deleting…" : "Delete list"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
