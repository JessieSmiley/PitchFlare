"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generatePitchDraft,
  generatePitchVariants,
  batchGeneratePitches,
} from "@/lib/pitches/ai";
import {
  approvePitch,
  deletePitch,
  updatePitchDraft,
} from "@/lib/pitches/actions";

export type PitchRow = {
  pitchId: string | null;
  status: "NONE" | "DRAFT" | "APPROVED" | "SENT" | "OPENED" | "REPLIED" | "PLACED" | "NO_RESPONSE" | "SCHEDULED";
  subject: string;
  body: string;
  contact: {
    id: string;
    name: string;
    email: string | null;
    outletName: string | null;
    kind: string;
    recentWorkTitles: string[];
  };
};

const STATUS_TONE: Record<string, string> = {
  NONE: "bg-muted text-muted-foreground",
  DRAFT: "bg-accent text-accent-foreground",
  APPROVED: "bg-brand-pink/10 text-brand-pink",
  SENT: "bg-brand-navy/10 text-brand-navy",
  OPENED: "bg-brand-navy/10 text-brand-navy",
  REPLIED: "bg-brand-navy text-white",
  PLACED: "bg-brand-pink text-white",
};

export function PitchComposer({
  campaignId,
  rows,
  opusByDefault,
}: {
  campaignId: string;
  rows: PitchRow[];
  opusByDefault: boolean;
}) {
  const router = useRouter();
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    rows[0]?.contact.id ?? null,
  );
  const [useOpus, setUseOpus] = useState(opusByDefault);
  const [batchPending, startBatch] = useTransition();
  const [batchMessage, setBatchMessage] = useState<string | null>(null);

  const selected = rows.find((r) => r.contact.id === selectedContactId) ?? null;
  const draftsReady = rows.filter((r) => r.status !== "NONE").length;

  function runBatch() {
    const missing = rows
      .filter((r) => r.status === "NONE")
      .map((r) => r.contact.id);
    if (missing.length === 0) return;
    setBatchMessage(null);
    startBatch(async () => {
      const res = await batchGeneratePitches({
        campaignId,
        contactIds: missing,
        useOpus,
      });
      if (!res.ok) {
        setBatchMessage(res.error);
        return;
      }
      setBatchMessage(
        `Generated ${res.generated}${res.failed ? `, ${res.failed} failed` : ""}.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
        <div className="text-sm">
          <span className="font-medium text-brand-navy">
            {draftsReady} / {rows.length}
          </span>{" "}
          <span className="text-muted-foreground">drafts ready</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={useOpus}
              onChange={(e) => setUseOpus(e.target.checked)}
            />
            Use Opus
          </label>
          <button
            type="button"
            onClick={runBatch}
            disabled={batchPending || rows.every((r) => r.status !== "NONE")}
            className="rounded-full bg-brand-pink px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {batchPending ? "Generating…" : "✦ Generate all drafts"}
          </button>
        </div>
      </div>

      {batchMessage && (
        <p className="text-xs text-muted-foreground">{batchMessage}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="max-h-[520px] overflow-y-auto rounded-lg border border-border bg-card">
          <ul className="divide-y divide-border">
            {rows.length === 0 && (
              <li className="p-4 text-xs text-muted-foreground">
                No contacts on this campaign yet. Build a target list first.
              </li>
            )}
            {rows.map((r) => (
              <li key={r.contact.id}>
                <button
                  type="button"
                  onClick={() => setSelectedContactId(r.contact.id)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${
                    r.contact.id === selectedContactId ? "bg-accent" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-brand-navy">
                      {r.contact.name}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${STATUS_TONE[r.status]}`}
                    >
                      {r.status === "NONE" ? "Not started" : r.status}
                    </span>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {r.contact.outletName ?? r.contact.kind}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {selected ? (
          <PitchEditor
            key={selected.contact.id}
            campaignId={campaignId}
            row={selected}
            useOpus={useOpus}
            onSaved={() => router.refresh()}
          />
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-card p-10 text-sm text-muted-foreground">
            Pick a contact on the left.
          </div>
        )}
      </div>
    </div>
  );
}

function PitchEditor({
  campaignId,
  row,
  useOpus,
  onSaved,
}: {
  campaignId: string;
  row: PitchRow;
  useOpus: boolean;
  onSaved: () => void;
}) {
  const [subject, setSubject] = useState(row.subject);
  const [body, setBody] = useState(row.body);
  const [pitchId, setPitchId] = useState<string | null>(row.pitchId);
  const [status, setStatus] = useState(row.status);
  const [error, setError] = useState<string | null>(null);

  const [generating, startGenerate] = useTransition();
  const [savingNow, startSave] = useTransition();
  const [approving, startApprove] = useTransition();
  const [variantsBusy, startVariants] = useTransition();

  const [variants, setVariants] = useState<
    Array<{ label: string; subject: string; body: string }>
  >([]);

  const locked = status !== "NONE" && status !== "DRAFT" && status !== "APPROVED";

  function generate() {
    setError(null);
    startGenerate(async () => {
      const res = await generatePitchDraft({
        campaignId,
        contactId: row.contact.id,
        useOpus,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSubject(res.subject);
      setBody(res.body);
      setPitchId(res.pitchId);
      setStatus("DRAFT");
      onSaved();
    });
  }

  function save() {
    if (!pitchId) return;
    setError(null);
    startSave(async () => {
      const res = await updatePitchDraft({ pitchId, subject, body });
      if (!res.ok) setError(res.error);
      else onSaved();
    });
  }

  function approve() {
    if (!pitchId) return;
    setError(null);
    startApprove(async () => {
      const res = await approvePitch({ pitchId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setStatus("APPROVED");
      onSaved();
    });
  }

  function loadVariants() {
    setError(null);
    startVariants(async () => {
      const res = await generatePitchVariants({
        campaignId,
        contactId: row.contact.id,
        useOpus,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setVariants(res.variants);
    });
  }

  function pickVariant(v: { label: string; subject: string; body: string }) {
    setSubject(v.subject);
    setBody(v.body);
    setVariants([]);
  }

  async function remove() {
    if (!pitchId) return;
    const res = await deletePitch({ pitchId });
    if (!res.ok) setError(res.error);
    else {
      setPitchId(null);
      setStatus("NONE");
      setSubject("");
      setBody("");
      onSaved();
    }
  }

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;

  return (
    <div className="grid gap-4 rounded-lg border border-border bg-card p-5 lg:grid-cols-[1fr_1.5fr]">
      <aside className="text-sm">
        <h3 className="font-display text-lg text-brand-navy">
          {row.contact.name}
        </h3>
        <p className="text-xs text-muted-foreground">
          {row.contact.outletName ?? row.contact.kind}
        </p>
        {row.contact.email ? (
          <p className="mt-1 font-mono text-xs text-brand-navy">
            {row.contact.email}
          </p>
        ) : (
          <p className="mt-1 text-xs text-destructive">
            No email on file — add one before Execute.
          </p>
        )}
        {row.contact.recentWorkTitles.length > 0 && (
          <>
            <h4 className="mt-4 text-xs font-semibold uppercase text-muted-foreground">
              Recent work
            </h4>
            <ul className="mt-1 space-y-1 text-xs">
              {row.contact.recentWorkTitles.slice(0, 5).map((t) => (
                <li key={t} className="text-brand-navy">• {t}</li>
              ))}
            </ul>
          </>
        )}
      </aside>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] ${STATUS_TONE[status]}`}
            >
              {status === "NONE" ? "Not started" : status}
            </span>
            <span className="text-xs text-muted-foreground">
              {wordCount} word{wordCount === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={generate}
              disabled={generating || locked}
              className="rounded-full bg-brand-pink px-3 py-1 text-xs text-white disabled:opacity-60"
            >
              {generating
                ? "Generating…"
                : status === "NONE"
                  ? "✦ Generate draft"
                  : "✦ Regenerate"}
            </button>
            <button
              type="button"
              onClick={loadVariants}
              disabled={variantsBusy || locked}
              className="rounded-full border border-border px-3 py-1 text-xs hover:border-brand-pink"
            >
              {variantsBusy ? "Generating…" : "3 variants"}
            </button>
          </div>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={locked}
          placeholder="Subject line"
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm disabled:opacity-60"
        />

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={locked}
          rows={10}
          placeholder="Pitch body — under 150 words, specific to their work, one clear ask."
          className="w-full rounded-md border border-border bg-white px-3 py-2 font-mono text-xs leading-relaxed disabled:opacity-60"
        />

        <div className="flex flex-wrap justify-between gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={savingNow || !pitchId || locked}
              className="rounded-full border border-border px-3 py-1 text-xs hover:border-brand-pink disabled:opacity-60"
            >
              {savingNow ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              onClick={approve}
              disabled={approving || !pitchId || status !== "DRAFT"}
              className="rounded-full bg-brand-navy px-3 py-1 text-xs text-white disabled:opacity-60"
            >
              {approving ? "Approving…" : "Approve for send"}
            </button>
          </div>
          {pitchId && !locked && (
            <button
              type="button"
              onClick={remove}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              Delete
            </button>
          )}
        </div>

        {variants.length > 0 && (
          <div className="mt-3 space-y-2 rounded-md border border-dashed border-border p-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                Pick a variant
              </h4>
              <button
                type="button"
                onClick={() => setVariants([])}
                className="text-xs text-muted-foreground hover:text-brand-navy"
              >
                Dismiss
              </button>
            </div>
            <ul className="space-y-2">
              {variants.map((v, i) => (
                <li key={i} className="rounded-md border border-border bg-white p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium uppercase text-brand-pink">
                      {v.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => pickVariant(v)}
                      className="rounded-full bg-brand-pink px-2 py-0.5 text-[10px] text-white"
                    >
                      Use this
                    </button>
                  </div>
                  <p className="text-xs font-medium text-brand-navy">
                    {v.subject}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                    {v.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
