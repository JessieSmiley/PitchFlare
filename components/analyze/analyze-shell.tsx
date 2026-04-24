"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addCoverageFromUrl,
  promoteMentionToClip,
  runMonitoringOnce,
} from "@/lib/monitoring/actions";

export type Metrics = {
  totalClips: number;
  totalReach: number;
  sentimentScore: number | null; // average
  sov: number | null;
};

export type ClipRow = {
  id: string;
  headline: string;
  url: string;
  outletName: string | null;
  publishedAt: Date | null;
  sentimentLabel: string | null;
  reachEstimate: number | null;
};

export type MentionRow = {
  id: string;
  title: string;
  url: string;
  outletName: string | null;
  publishedAt: Date | null;
};

export function AnalyzeShell({
  campaignId,
  metrics,
  clips,
  mentions,
}: {
  campaignId: string;
  metrics: Metrics;
  clips: ClipRow[];
  mentions: MentionRow[];
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [adding, startAdd] = useTransition();
  const [monitoring, startMonitor] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function addCoverage() {
    if (!url.trim()) return;
    setError(null);
    setInfo(null);
    startAdd(async () => {
      const res = await addCoverageFromUrl({ campaignId, url });
      if (!res.ok) setError(res.error);
      else {
        setUrl("");
        router.refresh();
      }
    });
  }

  function runNow() {
    setError(null);
    setInfo(null);
    startMonitor(async () => {
      const res = await runMonitoringOnce({ campaignId });
      if (!res.ok) setError(res.error);
      else {
        setInfo(
          `Monitoring run: ${res.inserted} new, ${res.skipped} duplicates.`,
        );
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <MetricsRow metrics={metrics} />

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <div className="flex flex-col gap-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-display text-lg text-brand-navy">
              Add coverage
            </h2>
            <p className="text-xs text-muted-foreground">
              Paste an article URL — we&apos;ll scrape it, run Claude for
              sentiment + rough reach, and add it to the feed.
            </p>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://techpress.example/…"
              className="mt-3 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={addCoverage}
              disabled={adding || !url.trim()}
              className="mt-2 w-full rounded-full bg-brand-pink px-3 py-1.5 text-xs text-white disabled:opacity-60"
            >
              {adding ? "Adding…" : "Add clip"}
            </button>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg text-brand-navy">
                Auto-monitor
              </h2>
              <button
                type="button"
                onClick={runNow}
                disabled={monitoring}
                className="rounded-full border border-border px-2 py-1 text-xs hover:border-brand-pink disabled:opacity-60"
              >
                {monitoring ? "Running…" : "Run now"}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Google News RSS queries the brand + campaign title every 6
              hours via Vercel Cron. Promote raw mentions to clips to add
              them to reports.
            </p>
          </section>

          {(error || info) && (
            <p
              className={`text-xs ${error ? "text-destructive" : "text-muted-foreground"}`}
            >
              {error ?? info}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <ClipsFeed clips={clips} />
          <MentionsFeed
            mentions={mentions}
            onPromote={async (id) => {
              const res = await promoteMentionToClip({
                mentionId: id,
                campaignId,
              });
              if (!res.ok) setError(res.error);
              else router.refresh();
            }}
          />
        </div>
      </div>
    </div>
  );
}

function MetricsRow({ metrics }: { metrics: Metrics }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="Coverage" value={metrics.totalClips.toLocaleString()} />
      <Metric
        label="Est. reach"
        value={metrics.totalReach ? metrics.totalReach.toLocaleString() : "—"}
      />
      <Metric
        label="Avg sentiment"
        value={
          typeof metrics.sentimentScore === "number"
            ? metrics.sentimentScore.toFixed(2)
            : "—"
        }
        tone={
          typeof metrics.sentimentScore === "number"
            ? metrics.sentimentScore > 0.1
              ? "pos"
              : metrics.sentimentScore < -0.1
                ? "neg"
                : "neu"
            : undefined
        }
      />
      <Metric
        label="Share of Voice"
        value={metrics.sov != null ? `${Math.round(metrics.sov * 100)}%` : "—"}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neu" | "neg";
}) {
  const toneClass =
    tone === "pos"
      ? "text-brand-pink"
      : tone === "neg"
        ? "text-destructive"
        : "text-brand-navy";
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-2xl ${toneClass}`}>{value}</div>
    </div>
  );
}

function ClipsFeed({ clips }: { clips: ClipRow[] }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="border-b border-border p-3 text-xs uppercase text-muted-foreground">
        Coverage clips ({clips.length})
      </div>
      {clips.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          No clips yet. Add one manually or run the monitor.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {clips.map((c) => (
            <li key={c.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate font-medium text-brand-navy hover:text-brand-pink"
                  >
                    {c.headline}
                  </a>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {c.outletName && <span>{c.outletName}</span>}
                    {c.publishedAt && (
                      <span>· {c.publishedAt.toLocaleDateString()}</span>
                    )}
                    {c.reachEstimate != null && (
                      <span>· reach ~{c.reachEstimate.toLocaleString()}</span>
                    )}
                  </div>
                </div>
                {c.sentimentLabel && (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
                      c.sentimentLabel === "POSITIVE"
                        ? "bg-brand-pink/10 text-brand-pink"
                        : c.sentimentLabel === "NEGATIVE"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {c.sentimentLabel}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MentionsFeed({
  mentions,
  onPromote,
}: {
  mentions: MentionRow[];
  onPromote: (id: string) => void | Promise<void>;
}) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="border-b border-border p-3 text-xs uppercase text-muted-foreground">
        Raw mentions ({mentions.length})
      </div>
      {mentions.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          No mentions yet — the monitor will fill this list.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {mentions.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-3 p-3">
              <div className="min-w-0 flex-1">
                <a
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-sm text-brand-navy hover:text-brand-pink"
                >
                  {m.title}
                </a>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {m.outletName && <span>{m.outletName}</span>}
                  {m.publishedAt && (
                    <span>· {m.publishedAt.toLocaleDateString()}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onPromote(m.id)}
                className="shrink-0 rounded-full border border-border px-3 py-1 text-xs hover:border-brand-pink"
              >
                Promote to clip
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
