"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Topic = { id: string; title: string; body: string; href?: string };

export function HelpSearch({ topics }: { topics: Topic[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return topics;
    return topics.filter(
      (t) =>
        t.title.toLowerCase().includes(needle) ||
        t.body.toLowerCase().includes(needle),
    );
  }, [topics, q]);
  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search help topics…"
        className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
        aria-label="Search help topics"
      />
      <ul className="space-y-3">
        {filtered.length === 0 ? (
          <li className="text-sm text-muted-foreground">No matches.</li>
        ) : (
          filtered.map((t) => (
            <li
              key={t.id}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-lg text-brand-navy">
                  {t.title}
                </h2>
                {t.href && (
                  <Link
                    href={t.href}
                    className="shrink-0 text-xs text-brand-pink hover:underline"
                  >
                    Open →
                  </Link>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{t.body}</p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
