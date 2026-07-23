"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { createBrandAction, switchBrandAction } from "@/lib/auth/actions";

export type SidebarBrand = { id: string; name: string; slug: string };
export type SidebarCampaign = { id: string; title: string };
export type SidebarList = { id: string; name: string };

export type BrandCreationInfo = {
  canAdd: boolean;
  reason: string | null;
  planLabel: string;
};

export function SidebarNav({
  brands,
  currentBrandId,
  campaigns,
  lists,
  brandCreation,
}: {
  brands: SidebarBrand[];
  currentBrandId: string | null;
  campaigns: SidebarCampaign[];
  lists: SidebarList[];
  brandCreation: BrandCreationInfo;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [modal, setModal] = useState<null | "create" | "upgrade">(null);

  const activeCampaignId = params.get("campaignId");

  function switchBrand(id: string) {
    if (id === currentBrandId) {
      router.push("/dashboard/level-set");
      return;
    }
    startTransition(async () => {
      const res = await switchBrandAction(id);
      if (res.ok) {
        router.push("/dashboard/level-set");
        router.refresh();
      } else {
        alert(res.error);
      }
    });
  }

  function onAddNew() {
    setModal(brandCreation.canAdd ? "create" : "upgrade");
  }

  return (
    <>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2 text-sm">
        {/* Dashboard — default landing, above the numbered setup steps */}
        <Link
          href="/dashboard"
          className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2 font-semibold text-brand-navy transition-colors hover:bg-brand-mist ${
            pathname === "/dashboard" ? "bg-brand-mist" : ""
          }`}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-pink text-white">
            <HomeIcon />
          </span>
          <span>Dashboard</span>
        </Link>

        {/* Media Lists — top-level, above the numbered setup steps */}
        <Link
          href="/dashboard/lists"
          className={`flex items-center gap-3 rounded-lg px-3 py-2 font-semibold text-brand-navy transition-colors hover:bg-brand-mist ${
            pathname.startsWith("/dashboard/lists") ? "bg-brand-mist" : ""
          }`}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-navy text-white">
            <ListIcon />
          </span>
          <span>Media Lists</span>
        </Link>
        <div className="ml-9 flex flex-col gap-0.5">
          {lists.map((l) => (
            <Link
              key={l.id}
              href={`/dashboard/lists/${l.id}`}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-brand-mist hover:text-brand-navy ${
                pathname === `/dashboard/lists/${l.id}`
                  ? "text-brand-pink"
                  : "text-slate-500"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  pathname === `/dashboard/lists/${l.id}`
                    ? "bg-brand-pink"
                    : "bg-slate-300"
                }`}
                aria-hidden
              />
              <span className="truncate">{l.name}</span>
            </Link>
          ))}
          <Link
            href="/dashboard/lists"
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-brand-pink transition-colors hover:bg-brand-mist"
          >
            {lists.length > 0 ? "View all lists" : "+ New list"}
          </Link>
        </div>

        <div className="my-1 h-px bg-slate-100" />

        {/* 1 — Brands (formerly Level-Set) */}
        <NavItem
          href="/dashboard/level-set"
          n={1}
          label="Brands"
          active={pathname === "/dashboard/level-set"}
        />
        <div className="ml-9 flex flex-col gap-0.5">
          {brands.map((b) => (
            <button
              key={b.id}
              type="button"
              disabled={isPending}
              onClick={() => switchBrand(b.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs font-medium transition-colors hover:bg-brand-mist hover:text-brand-navy disabled:opacity-60 ${
                b.id === currentBrandId
                  ? "text-brand-pink"
                  : "text-slate-500"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  b.id === currentBrandId ? "bg-brand-pink" : "bg-slate-300"
                }`}
                aria-hidden
              />
              <span className="truncate">{b.name}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={onAddNew}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs font-medium text-brand-pink transition-colors hover:bg-brand-mist"
          >
            + Add new
          </button>
        </div>

        {/* 2 — Strategize (campaigns nest here, like brands under #1) */}
        <NavItem
          href="/dashboard/strategize/ideation"
          n={2}
          label="Strategize"
          active={pathname.startsWith("/dashboard/strategize")}
        />
        <div className="ml-9 flex flex-col gap-0.5">
          {campaigns.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/strategize/ideation?campaignId=${c.id}`}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-brand-mist hover:text-brand-navy ${
                c.id === activeCampaignId
                  ? "text-brand-pink"
                  : "text-slate-500"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  c.id === activeCampaignId ? "bg-brand-pink" : "bg-slate-300"
                }`}
                aria-hidden
              />
              <span className="truncate">{c.title}</span>
            </Link>
          ))}
          <Link
            href="/dashboard/strategize/ideation"
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-brand-mist ${
              pathname.startsWith("/dashboard/strategize") && !activeCampaignId
                ? "text-brand-pink"
                : "text-brand-pink/80"
            }`}
          >
            + New campaign
          </Link>
          <NavSub href="/dashboard/strategize/targets" label="Targets" />
        </div>

        {/* 3 — Draft */}
        <NavItem
          href="/dashboard/draft/pitches"
          n={3}
          label="Draft"
          active={pathname.startsWith("/dashboard/draft")}
        />
        <NavSub href="/dashboard/draft/pitches" label="Pitches" />
        <NavSub href="/dashboard/draft/press-releases" label="Press Releases" />
        <NavSub href="/dashboard/draft/social" label="Social Posts" />
        <NavSub href="/dashboard/draft/follow-ups" label="Follow-ups" />

        {/* 4 — Execute */}
        <NavItem
          href="/dashboard/execute/email"
          n={4}
          label="Execute"
          active={pathname.startsWith("/dashboard/execute")}
        />
        <NavSub href="/dashboard/execute/email" label="Direct Email" />
        <NavSub href="/dashboard/execute/wire" label="Wire Distribution" />

        {/* 5 — Analyze */}
        <NavItem
          href="/dashboard/analyze"
          n={5}
          label="Analyze"
          active={pathname.startsWith("/dashboard/analyze")}
        />
        <NavSub href="/dashboard/analyze/monitoring" label="Monitoring" />
        <NavSub href="/dashboard/analyze/sentiment" label="Sentiment" />

        {/* 6 — Report */}
        <NavItem
          href="/dashboard/report"
          n={6}
          label="Report"
          active={pathname.startsWith("/dashboard/report")}
        />
        <NavSub href="/dashboard/report/coverage" label="Coverage" />
        <NavSub href="/dashboard/report/sov" label="Share of Voice" />
        <NavSub href="/dashboard/report/roi" label="ROI" />
        <NavSub href="/dashboard/report/status" label="Status Reports" />
      </nav>

      {modal === "create" && (
        <CreateBrandModal
          onClose={() => setModal(null)}
          onTierBlocked={() => setModal("upgrade")}
        />
      )}
      {modal === "upgrade" && (
        <UpgradeModal
          planLabel={brandCreation.planLabel}
          reason={brandCreation.reason}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

function NavItem({
  href,
  n,
  label,
  active,
}: {
  href: string;
  n: number;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`mt-1 flex items-center gap-3 rounded-lg px-3 py-2 text-brand-navy transition-colors hover:bg-brand-mist ${
        active ? "bg-brand-mist" : ""
      }`}
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-navy text-xs font-bold text-white">
        {n}
      </span>
      <span className="font-semibold">{label}</span>
    </Link>
  );
}

function NavSub({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={`ml-9 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-brand-mist hover:text-brand-navy ${
        active ? "text-brand-pink" : "text-slate-500"
      }`}
    >
      {label}
    </Link>
  );
}

function CreateBrandModal({
  onClose,
  onTierBlocked,
}: {
  onClose: () => void;
  onTierBlocked: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", website: "", category: "" });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await createBrandAction({
        name: form.name,
        website: form.website || null,
        category: form.category || null,
      });
      if (res.ok) {
        onClose();
        router.push("/dashboard/level-set");
        router.refresh();
      } else if (
        res.code === "BRAND_LIMIT" ||
        res.code === "COUPLED_LIMIT" ||
        res.code === "SEAT_LIMIT"
      ) {
        // Server-side tier gate tripped (e.g. a concurrent change) — escalate.
        onTierBlocked();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <ModalShell onClose={onClose} title="Add a new brand">
      <p className="text-sm text-muted-foreground">
        Each brand is an isolated workspace — its own voice, campaigns, and
        reports.
      </p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <label className="block text-sm font-medium text-brand-navy">
          Brand name
          <input
            autoFocus
            required
            maxLength={80}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            placeholder="e.g. Acme Fintech"
          />
        </label>
        <label className="block text-sm font-medium text-brand-navy">
          Website <span className="text-muted-foreground">(optional)</span>
          <input
            type="url"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
            className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            placeholder="https://acme.com"
          />
        </label>
        <label className="block text-sm font-medium text-brand-navy">
          Category <span className="text-muted-foreground">(optional)</span>
          <input
            maxLength={60}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            placeholder="e.g. SaaS, Consumer, Healthcare"
          />
        </label>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2 text-sm text-brand-navy hover:border-brand-pink"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || !form.name.trim()}
            className="rounded-lg bg-brand-pink px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create brand"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function UpgradeModal({
  planLabel,
  reason,
  onClose,
}: {
  planLabel: string;
  reason: string | null;
  onClose: () => void;
}) {
  return (
    <ModalShell onClose={onClose} title="Upgrade to add another brand">
      <p className="text-sm text-muted-foreground">
        {reason ??
          `Your ${planLabel} plan doesn't have room for another brand.`}{" "}
        Upgrade your plan to unlock more brands.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-border px-3 py-2 text-sm text-brand-navy hover:border-brand-pink"
        >
          Not now
        </button>
        <Link
          href="/dashboard/settings/billing"
          onClick={onClose}
          className="rounded-lg bg-brand-pink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          View plans →
        </Link>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-xl text-brand-navy">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-brand-navy"
          >
            ✕
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

function HomeIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 9.5 12 3l9 6.5" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}
