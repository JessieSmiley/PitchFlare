"use client";

import { useState, useTransition } from "react";
import { deleteCompetitor, upsertCompetitor } from "@/lib/brand/actions";
import { Card, Field } from "./brand-basics-form";

type Competitor = {
  id: string;
  name: string;
  domain: string | null;
};

export function BrandCompetitorsList({
  brandId,
  initial,
}: {
  brandId: string;
  initial: Competitor[];
}) {
  const [rows, setRows] = useState<Competitor[]>(initial);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", domain: "" });
  const [isPending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function addRow() {
    if (!draft.name.trim()) return;
    setError(null);
    start(async () => {
      const res = await upsertCompetitor({
        brandId,
        name: draft.name,
        domain: draft.domain || null,
      });
      if (res.ok) {
        setRows((xs) => [
          ...xs,
          { id: res.id, name: draft.name, domain: draft.domain || null },
        ]);
        setDraft({ name: "", domain: "" });
        setAdding(false);
      } else {
        setError(res.error);
      }
    });
  }

  function saveRow(c: Competitor) {
    setError(null);
    start(async () => {
      const res = await upsertCompetitor({
        brandId,
        id: c.id,
        name: c.name,
        domain: c.domain,
      });
      if (!res.ok) setError(res.error);
    });
  }

  function remove(id: string) {
    setRows((xs) => xs.filter((x) => x.id !== id));
    start(async () => {
      await deleteCompetitor({ brandId, id });
    });
  }

  return (
    <Card title="Competitors">
      <p className="text-xs text-muted-foreground">
        Used for Share-of-Voice tracking in Analyze. Add at least 2 — the
        brands you measure yourself against in coverage.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}

      <ul className="space-y-3">
        {rows.map((c) => (
          <li
            key={c.id}
            className="grid gap-2 rounded-md border border-border bg-white p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <Field label="Name" required>
              <input
                value={c.name}
                onChange={(e) =>
                  setRows((xs) =>
                    xs.map((x) =>
                      x.id === c.id ? { ...x, name: e.target.value } : x,
                    ),
                  )
                }
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Domain">
              <input
                value={c.domain ?? ""}
                onChange={(e) =>
                  setRows((xs) =>
                    xs.map((x) =>
                      x.id === c.id ? { ...x, domain: e.target.value } : x,
                    ),
                  )
                }
                placeholder="acme.com"
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              />
            </Field>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => remove(c.id)}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Remove
              </button>
              <button
                type="button"
                onClick={() => saveRow(c)}
                disabled={isPending || !c.name.trim()}
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
          No competitors yet. Add at least 2.
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
            <Field label="Domain">
              <input
                value={draft.domain}
                onChange={(e) => setDraft({ ...draft, domain: e.target.value })}
                placeholder="acme.com"
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              />
            </Field>
          </div>
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
              Add competitor
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-full border border-dashed border-brand-pink px-3 py-1 text-xs text-brand-pink hover:bg-accent"
        >
          + Add competitor
        </button>
      )}
    </Card>
  );
}
