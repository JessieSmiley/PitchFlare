import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

/**
 * Dashboard shell placeholder. Replaced in Chunk C with:
 *   - real brand switcher (reads Clerk org publicMetadata)
 *   - six-phase sidebar wired to active route
 *   - search + notifications + quick-actions
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-[220px] shrink-0 border-r border-border bg-white">
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="h-7 w-7 rounded-full bg-brand-pink" aria-hidden />
          <span className="font-display text-xl text-brand-navy">
            PitchFlare
          </span>
        </div>

        <nav className="flex flex-col gap-1 px-2 py-2 text-sm">
          <NavItem href="/dashboard/level-set" n={1} label="Level-Set" />
          <NavItem href="/dashboard/strategize/ideation" n={2} label="Strategize" />
          <NavSub href="/dashboard/strategize/ideation" label="Ideation Station" />
          <NavSub href="/dashboard/strategize/targets" label="Targets" />
          <NavItem href="/dashboard/draft/pitches" n={3} label="Draft" />
          <NavSub href="/dashboard/draft/pitches" label="Pitches" />
          <NavSub href="/dashboard/draft/press-releases" label="Press Releases" />
          <NavSub href="/dashboard/draft/social" label="Social Posts" />
          <NavSub href="/dashboard/draft/follow-ups" label="Follow-ups" />
          <NavItem href="/dashboard/execute/email" n={4} label="Execute" />
          <NavSub href="/dashboard/execute/email" label="Direct Email" />
          <NavSub href="/dashboard/execute/wire" label="Wire Distribution" />
          <NavItem href="/dashboard/analyze" n={5} label="Analyze" />
          <NavSub href="/dashboard/analyze/monitoring" label="Monitoring" />
          <NavSub href="/dashboard/analyze/sentiment" label="Sentiment" />
          <NavItem href="/dashboard/report" n={6} label="Report" />
          <NavSub href="/dashboard/report/coverage" label="Coverage" />
          <NavSub href="/dashboard/report/sov" label="Share of Voice" />
          <NavSub href="/dashboard/report/roi" label="ROI" />
          <NavSub href="/dashboard/report/status" label="Status Reports" />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[52px] items-center justify-between border-b border-border bg-white px-6">
          <div className="text-sm text-muted-foreground">Brand switcher (Chunk C)</div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/draft/pitches"
              className="rounded-full bg-brand-pink px-4 py-1.5 text-sm text-white hover:opacity-90"
            >
              ✦ Write pitch
            </Link>
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-8">{children}</main>
      </div>
    </div>
  );
}

function NavItem({ href, n, label }: { href: string; n: number; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-md px-3 py-2 text-brand-navy hover:bg-muted"
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
        {n}
      </span>
      <span className="font-medium">{label}</span>
    </Link>
  );
}

function NavSub({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="ml-9 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-brand-navy"
    >
      {label}
    </Link>
  );
}
