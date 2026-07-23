"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { discoverContacts } from "@/lib/contacts/discover";
import type { DiscoveredPerson } from "@/lib/providers/types";
import type { CompanySummary } from "@/lib/intelligence/types";
import type { ContactLikelihood, LikelihoodBand } from "@/lib/contacts/likelihood";
import { LikelihoodPill } from "./likelihood-pill";
import { AddToListModal, type ListOption } from "./add-to-list-modal";
import { DiscoverPanel } from "./discover-panel";

export type ContactRow = {
  id: string;
  name: string;
  avatarUrl: string | null;
  kind: "JOURNALIST" | "PODCASTER" | "INFLUENCER" | "ANALYST" | "OUTLET";
  title: string | null;
  outletName: string | null;
  beats: string[];
  matchScore: number | null;
  likelihood: ContactLikelihood | null;
};

export type DiscoveryConfig = {
  partner: "HUNTER" | "APOLLO" | "PODCHASER" | "SPARKTORO";
  label: string;
  connected: boolean;
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
  discovery,
  lists = [],
  campaignId = null,
}: {
  contacts: ContactRow[];
  onSelect: (id: string) => void;
  discovery?: DiscoveryConfig | null;
  lists?: ListOption[];
  campaignId?: string | null;
}) {
  const [filter, setFilter] = useState<ContactRow["kind"] | "ALL">("ALL");
  const [band, setBand] = useState<LikelihoodBand | "ALL">("ALL");
  const [q, setQ] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [searching, startSearch] = useTransition();
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<{
    query: string;
    outletName?: string;
    company: CompanySummary | null;
    people: DiscoveredPerson[];
  } | null>(null);

  const trimmedQ = q.trim();
  // Offer outward discovery once the query looks like an outlet/company name
  // (the local filter already covers substrings of loaded contacts). This
  // runs on free web sources first, so it works with or without a connected
  // partner.
  const canOfferDiscovery = trimmedQ.length >= 2;

  function runDiscovery() {
    if (trimmedQ.length < 2) return;
    setSearchError(null);
    startSearch(async () => {
      const res = await discoverContacts({ query: trimmedQ });
      if (!res.ok) {
        setSearchError(res.error);
        return;
      }
      setResults({
        query: trimmedQ,
        outletName: res.outletName,
        company: res.company,
        people: res.people,
      });
    });
  }

  const visible = useMemo(() => {
    return contacts.filter((c) => {
      if (filter !== "ALL" && c.kind !== filter) return false;
      if (band !== "ALL" && c.likelihood?.band !== band) return false;
      if (q) {
        const needle = q.toLowerCase();
        const hay = `${c.name} ${c.outletName ?? ""} ${c.beats.join(" ")}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [contacts, filter, band, q]);

  const checkedVisible = visible.filter((c) => checked.has(c.id));
  const allVisibleChecked =
    visible.length > 0 && checkedVisible.length === visible.length;

  function toggleOne(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setChecked((prev) => {
      const next = new Set(prev);
      if (allVisibleChecked) visible.forEach((c) => next.delete(c.id));
      else visible.forEach((c) => next.add(c.id));
      return next;
    });
  }

  const checkedList = [...checked];

  return (
    <>
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
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-full bg-muted p-0.5 text-xs">
            {(
              [
                ["ALL", "All"],
                ["high", "High"],
                ["medium", "Medium"],
                ["low", "Low"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setBand(value)}
                className={`rounded-full px-3 py-1 ${
                  band === value
                    ? "bg-white font-medium text-brand-navy"
                    : "text-muted-foreground"
                }`}
                title="Filter by Likelihood to Cover"
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="search"
            placeholder="Search by name, outlet, beat…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              // Enter runs outward discovery (the local filter already updates
              // as you type). Matches the "Find contacts at …" button.
              if (e.key === "Enter" && canOfferDiscovery && !searching) {
                e.preventDefault();
                runDiscovery();
              }
            }}
            className="w-56 rounded-md border border-border bg-white px-3 py-1.5 text-xs"
          />
        </div>
      </div>

      {canOfferDiscovery && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs">
          <button
            type="button"
            onClick={runDiscovery}
            disabled={searching}
            className="rounded-md bg-brand-pink px-3 py-1 text-white hover:opacity-90 disabled:opacity-60"
          >
            {searching
              ? "Searching…"
              : `🔍 Find contacts at “${trimmedQ}”`}
          </button>
          {discovery?.connected ? (
            <span className="text-muted-foreground">
              Free web sources first · {discovery.label} fills gaps with
              verified emails
            </span>
          ) : (
            <span className="text-muted-foreground">
              Uses free web sources ·{" "}
              <Link
                href="/dashboard/settings/integrations"
                className="text-brand-pink hover:underline"
              >
                connect {discovery?.label ?? "a partner"}
              </Link>{" "}
              for verified emails
            </span>
          )}
          {searchError && (
            <span className="text-destructive">{searchError}</span>
          )}
        </div>
      )}

      {checked.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-brand-navy/5 px-3 py-2 text-xs">
          <span className="font-medium text-brand-navy">
            {checked.size} selected
          </span>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="rounded-md bg-brand-pink px-3 py-1 font-medium text-white hover:opacity-90"
          >
            + Add to list
          </button>
          <button
            type="button"
            onClick={() => setChecked(new Set())}
            className="text-muted-foreground hover:text-brand-navy"
          >
            Clear
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="w-8 p-3">
                <input
                  type="checkbox"
                  aria-label="Select all shown"
                  checked={allVisibleChecked}
                  onChange={toggleAllVisible}
                />
              </th>
              <th className="p-3 font-medium">Contact</th>
              <th className="p-3 font-medium">Outlet</th>
              <th className="p-3 font-medium">Beats</th>
              <th className="p-3 font-medium">Likelihood to Cover</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                  No contacts yet. Add one on the left, or import from a URL.
                </td>
              </tr>
            )}
            {visible.map((c) => (
              <tr
                key={c.id}
                className={`border-t border-border hover:bg-muted/50 ${
                  checked.has(c.id) ? "bg-brand-navy/5" : ""
                }`}
              >
                <td className="p-3 align-top">
                  <input
                    type="checkbox"
                    aria-label={`Select ${c.name}`}
                    checked={checked.has(c.id)}
                    onChange={() => toggleOne(c.id)}
                    className="mt-1"
                  />
                </td>
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
                <td className="max-w-xs p-3">
                  {c.likelihood ? (
                    <div className="flex flex-col gap-1">
                      <LikelihoodPill
                        score={c.likelihood.score}
                        band={c.likelihood.band}
                        confidence={c.likelihood.confidence}
                      />
                      {c.likelihood.rationale && (
                        <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                          {c.likelihood.rationale}
                        </span>
                      )}
                    </div>
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

    {results && discovery && (
      <DiscoverPanel
        providerLabel={discovery.label}
        query={results.query}
        outletName={results.outletName}
        company={results.company}
        people={results.people}
        lists={lists}
        campaignId={campaignId}
        onClose={() => setResults(null)}
      />
    )}

    {showAddModal && (
      <AddToListModal
        contactIds={checkedList}
        lists={lists}
        campaignId={campaignId}
        onClose={() => {
          setShowAddModal(false);
          setChecked(new Set());
        }}
      />
    )}
    </>
  );
}
