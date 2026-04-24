"use client";

import { useState, useTransition } from "react";
import {
  deleteBrandExample,
  upsertBrandExample,
} from "@/lib/brand/actions";
import { Card, Field } from "./brand-basics-form";

type Example = {
  id: string;
  title: string;
  url: string | null;
  description: string | null;
  emulate: boolean;
};

export function BrandExamplesList({
  brandId,
  initial,
}: {
  brandId: string;
  initial: Example[];
}) {
  const [examples, setExamples] = useState<Example[]>(initial);
  const [isPending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Omit<Example, "id">>({
    title: "",
    url: "",
    description: "",
    emulate: true,
  });

  function addExample() {
    if (!draft.title.trim()) return;
    start(async () => {
      const res = await upsertBrandExample({
        brandId,
        title: draft.title,
        url: draft.url || null,
        description: draft.description || null,
        emulate: draft.emulate,
      });
      if (res.ok) {
        setExamples((xs) => [
          ...xs,
          { id: res.id, ...draft, url: draft.url || null, description: draft.description || null },
        ]);
        setDraft({ title: "", url: "", description: "", emulate: true });
        setAdding(false);
      } else {
        alert(res.error);
      }
    });
  }

  function toggleEmulate(ex: Example) {
    const next = { ...ex, emulate: !ex.emulate };
    setExamples((xs) => xs.map((x) => (x.id === ex.id ? next : x)));
    start(async () => {
      await upsertBrandExample({
        brandId,
        id: ex.id,
        title: ex.title,
        url: ex.url,
        description: ex.description,
        emulate: !ex.emulate,
      });
    });
  }

  function remove(id: string) {
    setExamples((xs) => xs.filter((x) => x.id !== id));
    start(async () => {
      await deleteBrandExample({ brandId, id });
    });
  }

  return (
    <Card title="Prior campaigns & examples">
      <p className="text-xs text-muted-foreground">
        Work you want the AI to emulate, or reference pieces from other
        brands that hit the tone you&apos;re after.
      </p>

      {examples.length === 0 && !adding && (
        <p className="text-xs italic text-muted-foreground">
          No examples yet.
        </p>
      )}

      <ul className="space-y-2">
        {examples.map((ex) => (
          <li
            key={ex.id}
            className="flex items-start justify-between gap-3 rounded-md border border-border bg-white p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium text-brand-navy">
                  {ex.title}
                </span>
                {ex.url && (
                  <a
                    href={ex.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-brand-pink hover:underline"
                  >
                    open ↗
                  </a>
                )}
              </div>
              {ex.description && (
                <p className="text-xs text-muted-foreground">{ex.description}</p>
              )}
            </div>
            <label className="flex shrink-0 items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={ex.emulate}
                onChange={() => toggleEmulate(ex)}
              />
              emulate
            </label>
            <button
              type="button"
              onClick={() => remove(ex.id)}
              className="shrink-0 text-xs text-muted-foreground hover:text-destructive"
            >
              remove
            </button>
          </li>
        ))}
      </ul>

      {adding ? (
        <div className="space-y-2 rounded-md border border-dashed border-border p-3">
          <Field label="Title" required>
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            />
          </Field>
          <Field label="URL">
            <input
              type="url"
              value={draft.url ?? ""}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Description">
            <textarea
              rows={2}
              value={draft.description ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            />
          </Field>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={draft.emulate}
                onChange={(e) =>
                  setDraft({ ...draft, emulate: e.target.checked })
                }
              />
              Emulate this in future outputs
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="rounded-full border border-border px-3 py-1 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addExample}
                disabled={isPending || !draft.title.trim()}
                className="rounded-full bg-brand-pink px-3 py-1 text-xs text-white disabled:opacity-60"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-full border border-dashed border-brand-pink px-3 py-1 text-xs text-brand-pink hover:bg-accent"
        >
          + Add example
        </button>
      )}
    </Card>
  );
}
