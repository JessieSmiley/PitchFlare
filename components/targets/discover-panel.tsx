"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDiscoveredContacts } from "@/lib/contacts/discover";
import type { DiscoveredPerson } from "@/lib/providers/types";
import type { CompanySummary } from "@/lib/intelligence/types";
import { CompanyPanel } from "./company-panel";

function hasCompanyFacts(c: CompanySummary): boolean {
  return Boolean(
    c.description ||
      (c.funding && c.funding.length) ||
      (c.awards && c.awards.length) ||
      (c.socials && Object.keys(c.socials).length),
  );
}

const STATUS_LABEL: Record<string, string> = {
  VALID: "Verified",
  ACCEPT_ALL: "Accepts all",
  UNKNOWN: "Unverified",
  GUESSED: "Guessed",
  INVALID: "Invalid",
};

const STATUS_TONE: Record<string, string> = {
  VALID: "bg-green-100 text-green-700",
  ACCEPT_ALL: "bg-amber-100 text-amber-700",
  UNKNOWN: "bg-muted text-muted-foreground",
  GUESSED: "bg-amber-100 text-amber-700",
  INVALID: "bg-red-100 text-red-700",
};

const SOURCE_LABEL: Record<string, string> = {
  DATABASE: "Your database",
  CACHE: "Cache",
  PERMUTATION: "Pattern + verify",
  HUNTER: "Hunter.io",
  APOLLO: "Apollo",
  PROSPEO: "Prospeo",
  DROPCONTACT: "Dropcontact",
  PEOPLE_DATA_LABS: "People Data Labs",
};

export function DiscoverPanel({
  providerLabel,
  query,
  outletName,
  company,
  people,
  onClose,
}: {
  providerLabel: string;
  query: string;
  outletName?: string;
  company?: CompanySummary | null;
  people: DiscoveredPerson[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState<{ added: number; skipped: number } | null>(
    null,
  );
  const [showCompany, setShowCompany] = useState(false);
  // Pre-select every candidate that came with an email — those are the
  // immediately useful ones to add.
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(people.map((_, i) => i).filter((i) => people[i].email)),
  );

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function addSelected() {
    if (selected.size === 0) return;
    setMessage(null);
    const chosen = [...selected].map((i) => people[i]);
    startSave(async () => {
      const res = await addDiscoveredContacts({ people: chosen });
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      setDone({ added: res.added, skipped: res.skipped });
      // Refresh so the new rows appear in the directory table behind the panel.
      router.refresh();
    });
  }

  return (
    <>
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/20"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-lg flex-col border-l border-border bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between border-b border-border p-6">
          <div>
            <h2 className="font-display text-2xl text-brand-navy">
              {providerLabel} results
            </h2>
            <p className="text-xs text-muted-foreground">
              {people.length} found for &ldquo;{query}&rdquo;
              {outletName && outletName.toLowerCase() !== query.toLowerCase()
                ? ` · ${outletName}`
                : ""}
              . Uses your {providerLabel} credits.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-2 py-1 text-xs"
          >
            Close
          </button>
        </header>

        {company && hasCompanyFacts(company) && (
          <section className="border-b border-border bg-muted/30 px-6 py-4 text-xs">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm text-brand-navy">
                {company.name}
              </h3>
              {company.socials &&
                Object.entries(company.socials).map(([k, url]) => (
                  <a
                    key={k}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-pink hover:underline"
                  >
                    {k}
                  </a>
                ))}
              <button
                type="button"
                onClick={() => setShowCompany(true)}
                className="ml-auto shrink-0 rounded-md border border-border px-2 py-1 text-[11px] text-brand-navy hover:bg-accent"
              >
                Full profile →
              </button>
            </div>
            {company.description && (
              <p className="mt-1 text-muted-foreground">
                {company.description.slice(0, 240)}
              </p>
            )}
            {company.funding && company.funding.length > 0 && (
              <p className="mt-2 text-brand-navy">
                <span className="font-medium">Funding:</span>{" "}
                {company.funding
                  .map((f) =>
                    [f.round, f.amount, f.date].filter(Boolean).join(" · "),
                  )
                  .filter(Boolean)
                  .join("  |  ")}
              </p>
            )}
            {company.awards && company.awards.length > 0 && (
              <p className="mt-1 text-brand-navy">
                <span className="font-medium">Awards:</span>{" "}
                {company.awards.map((a) => a.title).join(", ")}
              </p>
            )}
            <p className="mt-2 text-[10px] text-muted-foreground">
              Company facts from free web sources + AI extraction, cached.
            </p>
          </section>
        )}

        {done && (
          <div className="border-b border-emerald-200 bg-emerald-50 px-6 py-3 text-sm text-emerald-800">
            <p className="font-medium">
              ✓ Added {done.added} contact{done.added === 1 ? "" : "s"} to your
              directory
              {done.skipped > 0
                ? ` · ${done.skipped} already there`
                : ""}
              .
            </p>
            <p className="mt-0.5 text-xs text-emerald-700">
              They&apos;re now in the Target Compilation table, scored by
              Likelihood to Cover. Close this panel to see them.
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {people.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No people found. Try the outlet&apos;s full name or its domain.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {people.map((p, i) => (
                <li key={`${p.email ?? p.fullName}-${i}`}>
                  <label className="flex cursor-pointer items-start gap-3 p-4 hover:bg-muted/50">
                    <input
                      type="checkbox"
                      checked={selected.has(i)}
                      onChange={() => toggle(i)}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-brand-navy">
                          {p.fullName}
                        </span>
                        {typeof p.confidence === "number" && (
                          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                            {p.confidence}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {[p.title, p.outletName].filter(Boolean).join(" · ") ||
                          "—"}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="truncate font-mono text-xs text-brand-navy">
                          {p.email ?? "no email found"}
                        </span>
                        {p.email && p.emailStatus && (
                          <span
                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${STATUS_TONE[p.emailStatus] ?? "bg-muted text-muted-foreground"}`}
                            title={
                              p.emailSource
                                ? `Source: ${SOURCE_LABEL[p.emailSource] ?? p.emailSource}`
                                : undefined
                            }
                          >
                            {STATUS_LABEL[p.emailStatus] ?? p.emailStatus}
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border p-4">
          <span className="text-xs text-muted-foreground">
            {message ?? (done ? "Done" : `${selected.size} selected`)}
          </span>
          {done ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-brand-pink px-4 py-2 text-sm text-white"
            >
              Done — view in list
            </button>
          ) : (
            <button
              type="button"
              onClick={addSelected}
              disabled={saving || selected.size === 0}
              className="rounded-lg bg-brand-pink px-4 py-2 text-sm text-white disabled:opacity-60"
            >
              {saving ? "Adding…" : "Add selected"}
            </button>
          )}
        </footer>
      </aside>
    </div>

    {showCompany && company && (
      <CompanyPanel
        company={company}
        onClose={() => setShowCompany(false)}
      />
    )}
    </>
  );
}
