"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generateAngles,
  remixAngle,
  type GeneratedAngle,
} from "@/lib/campaigns/ai";
import { deleteAngle, setPrimaryAngle } from "@/lib/campaigns/actions";

type AngleRow = {
  id: string;
  title: string;
  hook: string | null;
  rationale: string | null;
  mediaFit: string | null;
  risk: string | null;
  newsworthinessScore: number | null;
  audienceFit: string | null;
};

export function IdeationCanvas({
  campaignId,
  primaryAngleId,
  angles,
}: {
  campaignId: string;
  primaryAngleId: string | null;
  angles: AngleRow[];
}) {
  const router = useRouter();
  const [generating, startGenerate] = useTransition();
  const [useOpus, setUseOpus] = useState(false);
  const [steer, setSteer] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleGenerate() {
    setError(null);
    startGenerate(async () => {
      const res = await generateAngles({
        campaignId,
        useOpus,
        steer: steer || undefined,
      });
      if (!res.ok) {
        setError(res.error);
      } else {
        router.refresh();
      }
    });
  }

  async function handleUse(angleId: string) {
    const res = await setPrimaryAngle({ campaignId, angleId });
    if (!res.ok) {
      setError(res.error);
    } else {
      router.refresh();
    }
  }

  async function handleDiscard(angleId: string) {
    await deleteAngle({ campaignId, angleId });
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg text-brand-navy">
              Ideation Station
            </h2>
            <p className="text-xs text-muted-foreground">
              Claude gives you five ranked angles grounded in your brand
              context and campaign setup.
            </p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={useOpus}
              onChange={(e) => setUseOpus(e.target.checked)}
            />
            Use Opus for deeper thinking
          </label>
        </div>

        <textarea
          rows={2}
          value={steer}
          onChange={(e) => setSteer(e.target.value)}
          placeholder="Optional: steer the angles (e.g. 'give me a more data-driven angle')"
          className="mt-3 w-full rounded-md border border-border bg-white px-3 py-2 text-xs"
        />

        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="mt-3 w-full rounded-full bg-brand-pink px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-60"
        >
          {generating ? "Generating angles…" : "✦ Generate pitch angles"}
        </button>

        {error && (
          <p className="mt-2 text-xs text-destructive">{error}</p>
        )}
      </div>

      {angles.length === 0 && !generating && (
        <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No angles yet — click Generate to get your first five.
        </div>
      )}

      <ul className="space-y-3">
        {angles.map((a) => (
          <AngleCard
            key={a.id}
            angle={a}
            isPrimary={a.id === primaryAngleId}
            campaignId={campaignId}
            onUse={() => handleUse(a.id)}
            onDiscard={() => handleDiscard(a.id)}
          />
        ))}
      </ul>
    </section>
  );
}

function AngleCard({
  angle,
  isPrimary,
  campaignId,
  onUse,
  onDiscard,
}: {
  angle: AngleRow;
  isPrimary: boolean;
  campaignId: string;
  onUse: () => void | Promise<void>;
  onDiscard: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [remixOpen, setRemixOpen] = useState(false);
  const [remixText, setRemixText] = useState("");
  const [remixing, startRemix] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRemix() {
    if (!remixText.trim()) return;
    setError(null);
    startRemix(async () => {
      const res = await remixAngle({
        campaignId,
        angleId: angle.id,
        direction: remixText,
      });
      if (!res.ok) {
        setError(res.error);
      } else {
        setRemixOpen(false);
        setRemixText("");
        router.refresh();
      }
    });
  }

  return (
    <li
      className={`rounded-lg border bg-card p-5 ${
        isPrimary ? "border-brand-pink ring-2 ring-accent" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg text-brand-navy">
              {angle.title}
            </h3>
            {isPrimary && (
              <span className="rounded-full bg-brand-pink px-2 py-0.5 text-[10px] font-medium text-white">
                Primary
              </span>
            )}
            {angle.mediaFit && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                {angle.mediaFit}
              </span>
            )}
            {typeof angle.newsworthinessScore === "number" && (
              <span className="text-xs text-muted-foreground">
                Newsworthiness: {angle.newsworthinessScore}/10
              </span>
            )}
          </div>
          {angle.hook && (
            <p className="mt-2 text-sm font-medium text-brand-navy">
              {angle.hook}
            </p>
          )}
          {angle.rationale && (
            <p className="mt-2 text-sm text-muted-foreground">
              {angle.rationale}
            </p>
          )}
          {angle.audienceFit && (
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-medium">Audience fit:</span> {angle.audienceFit}
            </p>
          )}
          {angle.risk && (
            <p className="mt-1 text-xs text-destructive">
              ⚠ {angle.risk}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onUse}
          disabled={isPrimary}
          className="rounded-full bg-brand-pink px-3 py-1 text-xs text-white disabled:opacity-50"
        >
          {isPrimary ? "✓ Using this angle" : "Use this angle"}
        </button>
        <button
          type="button"
          onClick={() => setRemixOpen((o) => !o)}
          className="rounded-full border border-border px-3 py-1 text-xs hover:border-brand-pink"
        >
          Remix
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-destructive"
        >
          Discard
        </button>
      </div>

      {remixOpen && (
        <div className="mt-3 space-y-2 rounded-md border border-dashed border-border p-3">
          <textarea
            rows={2}
            value={remixText}
            onChange={(e) => setRemixText(e.target.value)}
            placeholder="How should we remix this angle?"
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-xs"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRemixOpen(false)}
              className="rounded-full border border-border px-3 py-1 text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRemix}
              disabled={remixing || !remixText.trim()}
              className="rounded-full bg-brand-pink px-3 py-1 text-xs text-white disabled:opacity-60"
            >
              {remixing ? "Remixing…" : "Remix"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
