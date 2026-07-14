"use client";

import { useState, useTransition } from "react";
import { deletePillar, upsertPillar } from "@/lib/brand/actions";
import { Card, Field } from "./brand-basics-form";

type Pillar = {
  id: string;
  title: string;
  description: string | null;
  talkingPoints: string[];
};

export function BrandPillarsList({
  brandId,
  initial,
}: {
  brandId: string;
  initial: Pillar[];
}) {
  const [pillars, setPillars] = useState<Pillar[]>(initial);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    talkingPointsRaw: "",
  });
  const [isPending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function addPillar() {
    if (!draft.title.trim()) return;
    setError(null);
    const talkingPoints = splitLines(draft.talkingPointsRaw);
    start(async () => {
      const res = await upsertPillar({
        brandId,
        title: draft.title,
        description: draft.description || null,
        talkingPoints,
      });
      if (res.ok) {
        setPillars((xs) => [
          ...xs,
          {
            id: res.id,
            title: draft.title,
            description: draft.description || null,
            talkingPoints,
          },
        ]);
        setDraft({ title: "", description: "", talkingPointsRaw: "" });
        setAdding(false);
      } else {
        setError(res.error);
      }
    });
  }

  function saveRow(p: Pillar) {
    setError(null);
    start(async () => {
      const res = await upsertPillar({
        brandId,
        id: p.id,
        title: p.title,
        description: p.description,
        talkingPoints: p.talkingPoints,
      });
      if (!res.ok) setError(res.error);
    });
  }

  function remove(id: string) {
    setPillars((xs) => xs.filter((x) => x.id !== id));
    start(async () => {
      await deletePillar({ brandId, id });
    });
  }

  return (
    <Card title="Messaging pillars">
      <p className="text-xs text-muted-foreground">
        2–4 core ideas every pitch should ladder up to. Each pillar has a
        short description and a few talking points (one per line).
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}

      <ul className="space-y-3">
        {pillars.map((p) => (
          <li
            key={p.id}
            className="space-y-2 rounded-md border border-border bg-white p-3"
          >
            <Field label="Title" required>
              <input
                value={p.title}
                onChange={(e) =>
                  setPillars((xs) =>
                    xs.map((x) =>
                      x.id === p.id ? { ...x, title: e.target.value } : x,
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
                  setPillars((xs) =>
                    xs.map((x) =>
                      x.id === p.id ? { ...x, description: e.target.value } : x,
                    ),
                  )
                }
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Talking points" hint="One per line.">
              <textarea
                rows={3}
                value={p.talkingPoints.join("\n")}
                onChange={(e) =>
                  setPillars((xs) =>
                    xs.map((x) =>
                      x.id === p.id
                        ? { ...x, talkingPoints: splitLines(e.target.value) }
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
                disabled={isPending || !p.title.trim()}
                className="rounded-lg bg-brand-pink px-3 py-1 text-xs text-white disabled:opacity-60"
              >
                Save
              </button>
            </div>
          </li>
        ))}
      </ul>

      {pillars.length === 0 && !adding && (
        <p className="text-xs italic text-muted-foreground">
          No pillars yet. Add at least 2.
        </p>
      )}

      {adding ? (
        <div className="space-y-2 rounded-md border border-dashed border-border p-3">
          <Field label="Title" required>
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="e.g. Built for clinicians, by clinicians"
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
          <Field label="Talking points" hint="One per line.">
            <textarea
              rows={3}
              value={draft.talkingPointsRaw}
              onChange={(e) =>
                setDraft({ ...draft, talkingPointsRaw: e.target.value })
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
              onClick={addPillar}
              disabled={isPending || !draft.title.trim()}
              className="rounded-lg bg-brand-pink px-3 py-1 text-xs text-white disabled:opacity-60"
            >
              Add pillar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-full border border-dashed border-brand-pink px-3 py-1 text-xs text-brand-pink hover:bg-accent"
        >
          + Add pillar
        </button>
      )}
    </Card>
  );
}

function splitLines(s: string): string[] {
  return s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}
