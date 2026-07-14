"use client";

import { useState, useTransition } from "react";
import { deleteSpokesperson, upsertSpokesperson } from "@/lib/brand/actions";
import { Card, Field } from "./brand-basics-form";

type Spokesperson = {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
};

export function BrandSpokespeopleList({
  brandId,
  initial,
}: {
  brandId: string;
  initial: Spokesperson[];
}) {
  const [rows, setRows] = useState<Spokesperson[]>(initial);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", title: "", bio: "" });
  const [isPending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function addRow() {
    if (!draft.name.trim()) return;
    setError(null);
    start(async () => {
      const res = await upsertSpokesperson({
        brandId,
        name: draft.name,
        title: draft.title || null,
        bio: draft.bio || null,
      });
      if (res.ok) {
        setRows((xs) => [
          ...xs,
          {
            id: res.id,
            name: draft.name,
            title: draft.title || null,
            bio: draft.bio || null,
          },
        ]);
        setDraft({ name: "", title: "", bio: "" });
        setAdding(false);
      } else {
        setError(res.error);
      }
    });
  }

  function saveRow(s: Spokesperson) {
    setError(null);
    start(async () => {
      const res = await upsertSpokesperson({
        brandId,
        id: s.id,
        name: s.name,
        title: s.title,
        bio: s.bio,
      });
      if (!res.ok) setError(res.error);
    });
  }

  function remove(id: string) {
    setRows((xs) => xs.filter((x) => x.id !== id));
    start(async () => {
      await deleteSpokesperson({ brandId, id });
    });
  }

  return (
    <Card title="Spokespeople">
      <p className="text-xs text-muted-foreground">
        People available to be quoted in press releases or pitched as
        interview subjects.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}

      <ul className="space-y-3">
        {rows.map((s) => (
          <li
            key={s.id}
            className="space-y-2 rounded-md border border-border bg-white p-3"
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Name" required>
                <input
                  value={s.name}
                  onChange={(e) =>
                    setRows((xs) =>
                      xs.map((x) =>
                        x.id === s.id ? { ...x, name: e.target.value } : x,
                      ),
                    )
                  }
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Title">
                <input
                  value={s.title ?? ""}
                  onChange={(e) =>
                    setRows((xs) =>
                      xs.map((x) =>
                        x.id === s.id ? { ...x, title: e.target.value } : x,
                      ),
                    )
                  }
                  placeholder="CEO, Head of Product…"
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                />
              </Field>
            </div>
            <Field label="Bio">
              <textarea
                rows={2}
                value={s.bio ?? ""}
                onChange={(e) =>
                  setRows((xs) =>
                    xs.map((x) =>
                      x.id === s.id ? { ...x, bio: e.target.value } : x,
                    ),
                  )
                }
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              />
            </Field>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => remove(s.id)}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Remove
              </button>
              <button
                type="button"
                onClick={() => saveRow(s)}
                disabled={isPending || !s.name.trim()}
                className="rounded-lg bg-brand-pink px-3 py-1 text-xs text-white disabled:opacity-60"
              >
                Save
              </button>
            </div>
          </li>
        ))}
      </ul>

      {rows.length === 0 && !adding && (
        <p className="text-xs italic text-muted-foreground">
          No spokespeople yet. Add at least one.
        </p>
      )}

      {adding ? (
        <div className="space-y-2 rounded-md border border-dashed border-border p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Name" required>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Title">
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="CEO, Head of Product…"
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              />
            </Field>
          </div>
          <Field label="Bio">
            <textarea
              rows={2}
              value={draft.bio}
              onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-full border border-border px-3 py-1 text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={addRow}
              disabled={isPending || !draft.name.trim()}
              className="rounded-lg bg-brand-pink px-3 py-1 text-xs text-white disabled:opacity-60"
            >
              Add spokesperson
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-full border border-dashed border-brand-pink px-3 py-1 text-xs text-brand-pink hover:bg-accent"
        >
          + Add spokesperson
        </button>
      )}
    </Card>
  );
}
