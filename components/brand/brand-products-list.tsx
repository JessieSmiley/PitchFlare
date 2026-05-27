"use client";

import { useState, useTransition } from "react";
import { deleteProduct, upsertProduct } from "@/lib/brand/actions";
import { Card, Field } from "./brand-basics-form";

type Product = {
  id: string;
  name: string;
  description: string | null;
};

export function BrandProductsList({
  brandId,
  initial,
}: {
  brandId: string;
  initial: Product[];
}) {
  const [rows, setRows] = useState<Product[]>(initial);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", description: "" });
  const [isPending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function addRow() {
    if (!draft.name.trim()) return;
    setError(null);
    start(async () => {
      const res = await upsertProduct({
        brandId,
        name: draft.name,
        description: draft.description || null,
      });
      if (res.ok) {
        setRows((xs) => [
          ...xs,
          {
            id: res.id,
            name: draft.name,
            description: draft.description || null,
          },
        ]);
        setDraft({ name: "", description: "" });
        setAdding(false);
      } else {
        setError(res.error);
      }
    });
  }

  function saveRow(p: Product) {
    setError(null);
    start(async () => {
      const res = await upsertProduct({
        brandId,
        id: p.id,
        name: p.name,
        description: p.description,
      });
      if (!res.ok) setError(res.error);
    });
  }

  function remove(id: string) {
    setRows((xs) => xs.filter((x) => x.id !== id));
    start(async () => {
      await deleteProduct({ brandId, id });
    });
  }

  return (
    <Card title="Products">
      <p className="text-xs text-muted-foreground">
        The specific products, services, or SKUs you want pitches and
        releases to highlight.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}

      <ul className="space-y-3">
        {rows.map((p) => (
          <li
            key={p.id}
            className="space-y-2 rounded-md border border-border bg-white p-3"
          >
            <Field label="Name" required>
              <input
                value={p.name}
                onChange={(e) =>
                  setRows((xs) =>
                    xs.map((x) =>
                      x.id === p.id ? { ...x, name: e.target.value } : x,
                    ),
                  )
                }
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Description">
              <textarea
                rows={2}
                value={p.description ?? ""}
                onChange={(e) =>
                  setRows((xs) =>
                    xs.map((x) =>
                      x.id === p.id
                        ? { ...x, description: e.target.value }
                        : x,
                    ),
                  )
                }
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              />
            </Field>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Remove
              </button>
              <button
                type="button"
                onClick={() => saveRow(p)}
                disabled={isPending || !p.name.trim()}
                className="rounded-full bg-brand-pink px-3 py-1 text-xs text-white disabled:opacity-60"
              >
                Save
              </button>
            </div>
          </li>
        ))}
      </ul>

      {rows.length === 0 && !adding && (
        <p className="text-xs italic text-muted-foreground">
          No products yet. Add at least one.
        </p>
      )}

      {adding ? (
        <div className="space-y-2 rounded-md border border-dashed border-border p-3">
          <Field label="Name" required>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Description">
            <textarea
              rows={2}
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
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
              className="rounded-full bg-brand-pink px-3 py-1 text-xs text-white disabled:opacity-60"
            >
              Add product
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-full border border-dashed border-brand-pink px-3 py-1 text-xs text-brand-pink hover:bg-accent"
        >
          + Add product
        </button>
      )}
    </Card>
  );
}
