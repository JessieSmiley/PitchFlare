"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateStatusReport } from "@/lib/reports/status-report";
import { generateTalkingPoints } from "@/lib/reports/talking-points";
import { generateMediaBrief } from "@/lib/reports/media-brief";

type ContactOption = { id: string; name: string };
type ReportLink = { id: string; generatedAt: Date; title: string };

export function ReportTriggers({
  campaignId,
  contacts,
  statusReports,
  mediaBriefs,
  talkingPoints,
}: {
  campaignId: string;
  contacts: ContactOption[];
  statusReports: ReportLink[];
  mediaBriefs: ReportLink[];
  talkingPoints: ReportLink[];
}) {
  const router = useRouter();
  const [statusPending, startStatus] = useTransition();
  const [briefPending, startBrief] = useTransition();
  const [tpPending, startTp] = useTransition();

  const [error, setError] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    contacts[0]?.id ?? null,
  );

  function run(kind: "status" | "talking-points" | "media-brief") {
    setError(null);
    if (kind === "status") {
      startStatus(async () => {
        const res = await generateStatusReport({ campaignId });
        if (!res.ok) setError(res.error);
        else router.refresh();
      });
    } else if (kind === "talking-points") {
      startTp(async () => {
        const res = await generateTalkingPoints({ campaignId });
        if (!res.ok) setError(res.error);
        else router.refresh();
      });
    } else {
      if (!selectedContactId) return;
      startBrief(async () => {
        const res = await generateMediaBrief({
          contactId: selectedContactId,
          campaignId,
        });
        if (!res.ok) setError(res.error);
        else router.refresh();
      });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        <TriggerCard
          number={1}
          title="Status Report"
          description="Phase, outreach, coverage, risks, next actions — narrated for a CEO or client."
          pending={statusPending}
          onClick={() => run("status")}
        />
        <TriggerCard
          number={2}
          title="Media Brief"
          description="One-pager for a spokesperson before an interview. Bio, tone, angles, logistics."
          pending={briefPending}
          onClick={() => run("media-brief")}
          disabled={!selectedContactId}
          footer={
            <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
              Contact
              <select
                value={selectedContactId ?? ""}
                onChange={(e) => setSelectedContactId(e.target.value || null)}
                className="rounded-md border border-border bg-white px-2 py-1 text-[10px]"
              >
                {contacts.length === 0 && <option value="">— none —</option>}
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          }
        />
        <TriggerCard
          number={3}
          title="Talking Points"
          description="5 core messages × 3 proofs, 5 tough questions with responses, 3 phrases to avoid."
          pending={tpPending}
          onClick={() => run("talking-points")}
        />
      </div>

      <ReportArchive title="Status reports" type="status" items={statusReports} />
      <ReportArchive title="Media briefs" type="media-brief" items={mediaBriefs} />
      <ReportArchive
        title="Talking points"
        type="talking-points"
        items={talkingPoints}
      />
    </div>
  );
}

function TriggerCard({
  number,
  title,
  description,
  pending,
  disabled,
  onClick,
  footer,
}: {
  number: number;
  title: string;
  description: string;
  pending: boolean;
  disabled?: boolean;
  onClick: () => void;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
          {number}
        </span>
        <h3 className="font-display text-lg text-brand-navy">{title}</h3>
      </div>
      <p className="mt-2 flex-1 text-xs text-muted-foreground">{description}</p>
      {footer && <div className="mt-3">{footer}</div>}
      <button
        type="button"
        onClick={onClick}
        disabled={pending || disabled}
        className="mt-3 w-full rounded-full bg-brand-pink px-3 py-1.5 text-xs text-white disabled:opacity-60"
      >
        {pending ? "Generating…" : `✦ Generate ${title.toLowerCase()}`}
      </button>
    </div>
  );
}

function ReportArchive({
  title,
  type,
  items,
}: {
  title: string;
  type: "status" | "media-brief" | "talking-points";
  items: ReportLink[];
}) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="border-b border-border p-3 text-xs uppercase text-muted-foreground">
        {title}
      </div>
      {items.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          None yet. Generate one above.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-brand-navy">
                  {r.title}
                </div>
                <div className="text-xs text-muted-foreground">
                  {r.generatedAt.toLocaleString()}
                </div>
              </div>
              <a
                href={`/api/reports/${type}/${r.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-border px-3 py-1 text-xs hover:border-brand-pink"
              >
                Download PDF
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
