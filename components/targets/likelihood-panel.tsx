"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  EXCLUSIVES_FIELD_KEY,
  PR_DRIVEN_FIELD_KEY,
  type ContactLikelihood,
  type SignalContribution,
} from "@/lib/contacts/likelihood";
import { LikelihoodPill } from "./likelihood-pill";

type Field = { key: string; value: string; source: string };

type RefineFn = (input: {
  contactId: string;
  campaignId?: string | null;
}) => Promise<{ ok: true; rationale: string; score: number } | { ok: false; error: string }>;

type SetSignalFn = (input: {
  contactId: string;
  signal: "exclusives" | "prDriven";
  value: "yes" | "no" | "clear";
}) => Promise<{ ok: true } | { ok: false; error: string }>;

const WEIGHT_LABEL = (weight: number): string => {
  if (weight >= 3) return "Very high";
  if (weight >= 2) return "High";
  if (weight > 0) return "Medium";
  return "Negative";
};

/** Current stored value of a flag: USER_ADDED wins over any AI_INFERRED row. */
function currentFlag(fields: Field[], key: string): {
  value: "yes" | "no" | null;
  inferred: boolean;
} {
  const rows = fields.filter((f) => f.key === key);
  const user = rows.find((r) => r.source === "USER_ADDED");
  const inferred = rows.find((r) => r.source === "AI_INFERRED");
  const chosen = user ?? inferred;
  if (!chosen) return { value: null, inferred: false };
  const v = chosen.value.trim().toLowerCase();
  const yes = ["yes", "true", "likely", "1", "high"].includes(v);
  const no = ["no", "false", "unlikely", "0", "low"].includes(v);
  return {
    value: yes ? "yes" : no ? "no" : null,
    inferred: !user && !!inferred,
  };
}

export function LikelihoodPanel({
  contactId,
  campaignId,
  likelihood,
  fields,
  onRefine,
  onSetSignal,
}: {
  contactId: string;
  campaignId: string | null;
  likelihood: ContactLikelihood;
  fields: Field[];
  onRefine: RefineFn;
  onSetSignal: SetSignalFn;
}) {
  const router = useRouter();
  const [rationale, setRationale] = useState(likelihood.rationale);
  const [refining, startRefine] = useTransition();
  const [savingSignal, startSignal] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const breakdown = likelihood.breakdown ?? [];
  const available = breakdown.filter((b) => b.available);
  const unavailable = breakdown.filter((b) => !b.available);

  function refine() {
    setError(null);
    startRefine(async () => {
      const res = await onRefine({ contactId, campaignId });
      if (!res.ok) setError(res.error);
      else setRationale(res.rationale);
    });
  }

  function setSignal(signal: "exclusives" | "prDriven", value: "yes" | "no" | "clear") {
    setError(null);
    startSignal(async () => {
      const res = await onSetSignal({ contactId, signal, value });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  const exclusives = currentFlag(fields, EXCLUSIVES_FIELD_KEY);
  const prDriven = currentFlag(fields, PR_DRIVEN_FIELD_KEY);

  return (
    <section className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <LikelihoodPill
            score={likelihood.score}
            band={likelihood.band}
            confidence={likelihood.confidence}
            size="lg"
          />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Likelihood to Cover
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {likelihood.confidence}% confidence
        </span>
      </div>

      {rationale && (
        <p className="mt-3 text-sm leading-relaxed text-brand-navy">{rationale}</p>
      )}

      <button
        type="button"
        onClick={refine}
        disabled={refining}
        className="mt-2 text-xs text-brand-pink hover:underline disabled:opacity-60"
      >
        {refining ? "Refining…" : "✨ Refine reason with AI"}
      </button>

      {/* Signal breakdown — every firing signal, biggest contribution first. */}
      {available.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-border pt-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Why this score
          </h4>
          {[...available]
            .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
            .map((sig) => (
              <SignalRow key={sig.key} sig={sig} />
            ))}
        </div>
      )}

      {unavailable.length > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          No data yet for: {unavailable.map((s) => s.label.toLowerCase()).join(", ")}.
        </p>
      )}

      {/* Manual/AI-inferred flags the user can confirm or correct. */}
      <div className="mt-4 space-y-3 border-t border-border pt-3">
        <FlagControl
          title="Prefers exclusives"
          current={exclusives}
          disabled={savingSignal}
          onSet={(v) => setSignal("exclusives", v)}
        />
        <FlagControl
          title="Rarely writes press-release-driven stories"
          current={prDriven}
          disabled={savingSignal}
          onSet={(v) => setSignal("prDriven", v)}
        />
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </section>
  );
}

function SignalRow({ sig }: { sig: SignalContribution }) {
  const magnitude = Math.min(1, Math.abs(sig.subScore ?? 0));
  const pointsLabel = `${sig.points >= 0 ? "+" : "−"}${Math.abs(sig.points).toFixed(1)}`;
  return (
    <div className="text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-brand-navy">
          {sig.label}
          {sig.inferred && (
            <span className="ml-1 rounded bg-accent px-1 py-0.5 text-[9px] font-semibold uppercase text-accent-foreground">
              inferred
            </span>
          )}
        </span>
        <span
          className={`shrink-0 font-mono text-[11px] ${
            sig.penalty ? "text-destructive" : "text-emerald-600"
          }`}
        >
          {pointsLabel}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${sig.penalty ? "bg-destructive/70" : "bg-emerald-500/70"}`}
            style={{ width: `${Math.max(magnitude * 100, sig.points === 0 ? 0 : 6)}%` }}
          />
        </div>
        <span className="w-16 shrink-0 text-right text-[10px] uppercase text-muted-foreground">
          {WEIGHT_LABEL(sig.weight)}
        </span>
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{sig.detail}</p>
    </div>
  );
}

function FlagControl({
  title,
  current,
  disabled,
  onSet,
}: {
  title: string;
  current: { value: "yes" | "no" | null; inferred: boolean };
  disabled: boolean;
  onSet: (value: "yes" | "no" | "clear") => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-brand-navy">{title}</span>
        {current.inferred && current.value && (
          <span className="rounded bg-accent px-1 py-0.5 text-[9px] font-semibold uppercase text-accent-foreground">
            AI guess
          </span>
        )}
      </div>
      <div className="mt-1 flex gap-1">
        {(["yes", "no", "clear"] as const).map((option) => {
          const active =
            (option === "yes" && current.value === "yes" && !current.inferred) ||
            (option === "no" && current.value === "no" && !current.inferred);
          return (
            <button
              key={option}
              type="button"
              disabled={disabled}
              onClick={() => onSet(option)}
              className={`rounded-md border px-2 py-0.5 text-[11px] capitalize disabled:opacity-60 ${
                active
                  ? "border-brand-pink bg-brand-pink/10 font-medium text-brand-pink"
                  : "border-border text-muted-foreground hover:border-slate-300"
              }`}
            >
              {option === "clear" ? "Clear" : option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
