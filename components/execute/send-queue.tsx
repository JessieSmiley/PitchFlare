"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendApprovedPitches } from "@/lib/email/send";

export type QueueRow = {
  pitchId: string;
  subject: string;
  status: string;
  sentAt: Date | null;
  openedAt: Date | null;
  firstClickedAt: Date | null;
  contact: {
    id: string;
    name: string;
    email: string | null;
  };
};

export function SendQueue({ rows }: { rows: QueueRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, startSend] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [previewPitchId, setPreviewPitchId] = useState<string | null>(null);

  const approved = useMemo(
    () => rows.filter((r) => r.status === "APPROVED"),
    [rows],
  );
  const sent = useMemo(
    () => rows.filter((r) => r.status !== "APPROVED" && r.status !== "DRAFT"),
    [rows],
  );

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === approved.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(approved.map((r) => r.pitchId)));
    }
  }

  function send() {
    if (selected.size === 0) return;
    setResult(null);
    startSend(async () => {
      const res = await sendApprovedPitches({
        pitchIds: Array.from(selected),
      });
      if (!res.ok) {
        setResult(res.error);
        return;
      }
      setResult(
        `Sent ${res.sent}${res.failed ? `, ${res.failed} failed (${res.errors[0] ?? ""}${res.errors.length > 1 ? " …" : ""})` : ""}.`,
      );
      setSelected(new Set());
      router.refresh();
    });
  }

  const previewPitch = previewPitchId
    ? rows.find((r) => r.pitchId === previewPitchId)
    : null;

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
          <div className="text-sm">
            <span className="font-medium text-brand-navy">
              {approved.length}
            </span>{" "}
            <span className="text-muted-foreground">approved</span>
            <span className="mx-3 text-muted-foreground">·</span>
            <span className="font-medium text-brand-navy">{sent.length}</span>{" "}
            <span className="text-muted-foreground">sent</span>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-[10px] text-muted-foreground">
              Throttle: 1 send every 3 seconds.
            </p>
            <button
              type="button"
              onClick={send}
              disabled={sending || selected.size === 0}
              className="rounded-full bg-brand-pink px-4 py-2 text-sm text-white disabled:opacity-60"
            >
              {sending
                ? "Sending…"
                : `Send ${selected.size} pitch${selected.size === 1 ? "" : "es"}`}
            </button>
          </div>
        </div>

        {result && (
          <p className="text-xs text-muted-foreground">{result}</p>
        )}

        <section className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-3 text-xs uppercase text-muted-foreground">
            <span>Ready to send</span>
            {approved.length > 0 && (
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs normal-case text-brand-pink hover:underline"
              >
                {selected.size === approved.length ? "Clear all" : "Select all"}
              </button>
            )}
          </div>
          {approved.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No approved pitches. Approve drafts on the Pitches screen.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {approved.map((r) => (
                <li key={r.pitchId} className="flex items-start gap-3 p-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selected.has(r.pitchId)}
                    onChange={() => toggle(r.pitchId)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-brand-navy">
                        {r.contact.name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {r.contact.email ?? "(no email)"}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.subject}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewPitchId(r.pitchId)}
                    className="text-xs text-brand-pink hover:underline"
                  >
                    Preview
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card">
          <div className="border-b border-border p-3 text-xs uppercase text-muted-foreground">
            Sent
          </div>
          {sent.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No sent pitches yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {sent.map((r) => (
                <li key={r.pitchId} className="p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-medium text-brand-navy">
                      {r.contact.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {r.subject}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      {r.status}
                    </span>
                    {r.openedAt && (
                      <span className="rounded-full bg-brand-navy/10 px-2 py-0.5 text-[10px] text-brand-navy">
                        opened
                      </span>
                    )}
                    {r.firstClickedAt && (
                      <span className="rounded-full bg-brand-pink/10 px-2 py-0.5 text-[10px] text-brand-pink">
                        clicked
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {previewPitch && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setPreviewPitchId(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h3 className="font-display text-xl text-brand-navy">
                Preview
              </h3>
              <button
                type="button"
                onClick={() => setPreviewPitchId(null)}
                className="rounded-full border border-border px-2 py-1 text-xs"
              >
                Close
              </button>
            </div>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">To</dt>
              <dd className="text-brand-navy">
                {previewPitch.contact.name}
                {previewPitch.contact.email && (
                  <span className="ml-2 font-mono text-muted-foreground">
                    &lt;{previewPitch.contact.email}&gt;
                  </span>
                )}
              </dd>
              <dt className="text-muted-foreground">Subject</dt>
              <dd className="font-medium text-brand-navy">
                {previewPitch.subject}
              </dd>
            </dl>
            <p className="mt-4 text-[10px] text-muted-foreground">
              Open + click tracking pixels are injected automatically when
              the email is sent.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
