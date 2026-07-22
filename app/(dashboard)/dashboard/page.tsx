import Link from "next/link";
import { requireTenant } from "@/lib/auth/tenant";
import { switchBrandAction } from "@/lib/auth/actions";
import {
  getAccountOverview,
  type BrandSnapshot,
  type CampaignSnapshot,
  type DeadlineKind,
  type UpcomingDeadline,
} from "@/lib/dashboard/overview";
import type { CampaignPhase, CampaignStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const PHASE_ORDER: CampaignPhase[] = [
  "LEVEL_SET",
  "STRATEGIZE",
  "DRAFT",
  "EXECUTE",
  "ANALYZE",
  "REPORT",
];

const PHASE_LABEL: Record<CampaignPhase, string> = {
  LEVEL_SET: "Level-Set",
  STRATEGIZE: "Strategize",
  DRAFT: "Draft",
  EXECUTE: "Execute",
  ANALYZE: "Analyze",
  REPORT: "Report",
};

const STATUS_STYLE: Record<CampaignStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  ACTIVE: "bg-emerald-100 text-emerald-700",
  PAUSED: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  ARCHIVED: "bg-slate-100 text-slate-400",
};

const DEADLINE_LABEL: Record<DeadlineKind, string> = {
  LAUNCH: "Launch",
  EMBARGO: "Embargo",
  TIMELINE_END: "Timeline ends",
};

export default async function DashboardHome() {
  const tenant = await requireTenant();
  const overview = await getAccountOverview(tenant.account.id, tenant.user.id);
  const currentBrandId = tenant.brand?.id ?? null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-brand-navy">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            A snapshot of everything in flight — campaign status, progress, and
            upcoming deadlines, organized by brand.
          </p>
        </div>
        <Link
          href="/dashboard/strategize/ideation"
          className="rounded-lg bg-brand-pink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-pink-deep"
        >
          ✦ New campaign
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Brands" value={overview.totals.brands} />
        <StatTile
          label="Active campaigns"
          value={overview.totals.activeCampaigns}
          sub={`${overview.totals.campaigns} total`}
        />
        <StatTile
          label="Upcoming deadlines"
          value={overview.totals.upcomingDeadlines}
        />
        <StatTile
          label="Coverage clips"
          value={overview.totals.coverageClips}
        />
      </div>

      {overview.upcomingDeadlines.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-display text-lg text-brand-navy">
            Upcoming deadlines
          </h2>
          <ul className="mt-3 divide-y divide-border">
            {overview.upcomingDeadlines.slice(0, 8).map((d) => (
              <DeadlineRow key={`${d.campaignId}-${d.kind}`} deadline={d} />
            ))}
          </ul>
        </section>
      )}

      {overview.brands.length === 0 ? (
        <EmptyBrands />
      ) : (
        <div className="flex flex-col gap-6">
          {overview.brands.map((brand) => (
            <BrandCard
              key={brand.id}
              brand={brand}
              isCurrent={brand.id === currentBrandId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-3xl text-brand-navy">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function DeadlineRow({ deadline }: { deadline: UpcomingDeadline }) {
  const urgent = deadline.daysAway <= 7;
  return (
    <li className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <Link
          href={`/dashboard/strategize/ideation?campaignId=${deadline.campaignId}`}
          className="truncate text-sm font-medium text-brand-navy hover:text-brand-pink"
        >
          {deadline.campaignTitle}
        </Link>
        <div className="text-xs text-muted-foreground">
          {deadline.brandName} · {DEADLINE_LABEL[deadline.kind]}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm text-brand-navy">
          {deadline.date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>
        <div
          className={`text-xs ${urgent ? "font-medium text-destructive" : "text-muted-foreground"}`}
        >
          {deadline.daysAway === 0
            ? "Today"
            : deadline.daysAway === 1
              ? "Tomorrow"
              : `in ${deadline.daysAway} days`}
        </div>
      </div>
    </li>
  );
}

function BrandCard({
  brand,
  isCurrent,
}: {
  brand: BrandSnapshot;
  isCurrent: boolean;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl text-brand-navy">
              {brand.name}
            </h2>
            {isCurrent && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                Active
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {brand.activeCampaigns} active ·{" "}
            {brand.totalCampaigns} campaign
            {brand.totalCampaigns === 1 ? "" : "s"} · {brand.coverageClips}{" "}
            coverage clip{brand.coverageClips === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Brand profile
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-brand-pink"
                  style={{ width: `${brand.completion}%` }}
                  aria-hidden
                />
              </div>
              <span className="text-xs text-brand-navy">
                {brand.completion}%
              </span>
            </div>
          </div>
          <SwitchToBrand brandId={brand.id} isCurrent={isCurrent} />
        </div>
      </div>

      {brand.campaigns.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          No campaigns yet.{" "}
          <Link
            href="/dashboard/strategize/ideation"
            className="text-brand-pink hover:underline"
          >
            Start strategizing →
          </Link>
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {brand.campaigns.slice(0, 5).map((c) => (
            <CampaignRow key={c.id} campaign={c} />
          ))}
          {brand.campaigns.length > 5 && (
            <p className="pt-1 text-xs text-muted-foreground">
              + {brand.campaigns.length - 5} more campaign
              {brand.campaigns.length - 5 === 1 ? "" : "s"}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function CampaignRow({ campaign }: { campaign: CampaignSnapshot }) {
  const phaseIndex = PHASE_ORDER.indexOf(campaign.phase);
  const progressPct = Math.round(((phaseIndex + 1) / PHASE_ORDER.length) * 100);
  const nextDeadline = [
    campaign.launchDate,
    campaign.embargoDate,
    campaign.timelineEnd,
  ]
    .filter((d): d is Date => d != null && d.getTime() >= Date.now())
    .sort((a, b) => a.getTime() - b.getTime())[0];

  return (
    <Link
      href={`/dashboard/strategize/ideation?campaignId=${campaign.id}`}
      className="group flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-border bg-white p-3 transition hover:border-brand-pink"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-brand-navy">
            {campaign.title}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[campaign.status]}`}
          >
            {campaign.status}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1 w-28 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-brand-navy"
              style={{ width: `${progressPct}%` }}
              aria-hidden
            />
          </div>
          <span className="text-[11px] text-muted-foreground">
            {PHASE_LABEL[campaign.phase]}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <Metric label="angles" value={campaign.counts.angles} />
        <Metric label="pitches" value={campaign.counts.pitches} />
        <Metric label="coverage" value={campaign.counts.coverageClips} />
      </div>

      {nextDeadline && (
        <div className="text-right text-[11px]">
          <div className="text-muted-foreground">Next deadline</div>
          <div className="text-brand-navy">
            {nextDeadline.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </div>
        </div>
      )}
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <span className="whitespace-nowrap">
      <span className="font-medium text-brand-navy">{value}</span> {label}
    </span>
  );
}

function SwitchToBrand({
  brandId,
  isCurrent,
}: {
  brandId: string;
  isCurrent: boolean;
}) {
  if (isCurrent) {
    return (
      <Link
        href="/dashboard/level-set"
        className="rounded-md border border-border px-3 py-1.5 text-xs text-brand-navy hover:border-brand-pink"
      >
        Open →
      </Link>
    );
  }
  return (
    <form
      action={async () => {
        "use server";
        await switchBrandAction(brandId);
      }}
    >
      <button
        type="submit"
        className="rounded-md border border-border px-3 py-1.5 text-xs text-brand-navy hover:border-brand-pink"
      >
        Switch →
      </button>
    </form>
  );
}

function EmptyBrands() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
      <h2 className="font-display text-xl text-brand-navy">No brands yet</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Create your first brand to start building campaigns.
      </p>
      <Link
        href="/onboarding/brand"
        className="mt-4 inline-block rounded-lg bg-brand-pink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        Create a brand →
      </Link>
    </div>
  );
}
