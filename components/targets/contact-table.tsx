"use client";

import { useMemo, useState } from "react";

export type ContactRow = {
  id: string;
  name: string;
  avatarUrl: string | null;
  kind: "JOURNALIST" | "PODCASTER" | "INFLUENCER" | "ANALYST" | "OUTLET";
  title: string | null;
  outletName: string | null;
  beats: string[];
  matchScore: number | null;
};

const KIND_LABELS: Record<ContactRow["kind"], string> = {
  JOURNALIST: "Journalist",
  PODCASTER: "Podcaster",
  INFLUENCER: "Influencer",
  ANALYST: "Analyst",
  OUTLET: "Outlet",
};

export function ContactTable({
  contacts,
  onSelect,
}: {
  contacts: ContactRow[];
  onSelect: (id: string) => void;
}) {
  const [filter, setFilter] = useState<ContactRow["kind"] | "ALL">("ALL");
  const [q, setQ] = useState("");

  const visible = useMemo(() => {
    return contacts.filter((c) => {
      if (filter !== "ALL" && c.kind !== filter) return false;
      if (q) {
        const needle = q.toLowerCase();
        const hay = `${c.name} ${c.outletName ?? ""} ${c.beats.join(" ")}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [contacts, filter, q]);

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
        <div className="flex gap-1 rounded-full bg-muted p-0.5 text-xs">
          {(["ALL", "JOURNALIST", "PODCASTER", "INFLUENCER", "OUTLET"] as const).map(
            (f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 ${
                  filter === f
                    ? "bg-white font-medium text-brand-navy"
                    : "text-muted-foreground"
                }`}
              >
                {f === "ALL" ? "All" : KIND_LABELS[f]}
              </button>
            ),
          )}
        </div>
        <input
          type="search"
          placeholder="Search by name, outlet, beat…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-64 rounded-md border border-border bg-white px-3 py-1.5 text-xs"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="p-3 font-medium">Contact</th>
              <th className="p-3 font-medium">Outlet</th>
              <th className="p-3 font-medium">Beats</th>
              <th className="p-3 font-medium">Match</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                  No contacts yet. Add one on the left, or import from a URL.
                </td>
              </tr>
            )}
            {visible.map((c) => (
              <tr
                key={c.id}
                className="border-t border-border hover:bg-muted/50"
              >
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    {c.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.avatarUrl}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="truncate font-medium text-brand-navy">
                        {c.name}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {c.title ?? KIND_LABELS[c.kind]}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="p-3 text-sm text-brand-navy">
                  {c.outletName ?? "—"}
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {c.beats.slice(0, 3).map((b) => (
                      <span
                        key={b}
                        className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {b}
                      </span>
                    ))}
                    {c.beats.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{c.beats.length - 3}
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  {typeof c.matchScore === "number" ? (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                      {c.matchScore}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-3 text-right">
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    className="text-xs text-brand-pink hover:underline"
                  >
                    View →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
