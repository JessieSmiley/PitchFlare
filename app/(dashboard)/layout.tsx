import Link from "next/link";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { getTenant, listAccessibleBrands } from "@/lib/auth/tenant";
import { BrandSwitcher } from "@/components/brand-switcher";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await getTenant();

  // No account yet → Clerk org not picked, webhook hasn't run, or brand-new
  // sign-up. Send them through onboarding.
  if (!tenant) redirect("/onboarding");

  // Signed-in and provisioned but no brand yet → force brand creation first.
  if (!tenant.brand) redirect("/onboarding/brand");

  const brands = await listAccessibleBrands(tenant.account.id, tenant.user.id);

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

        <div className="mt-auto border-t border-border px-2 py-3">
          <Link
            href="/dashboard/settings/billing"
            className="block rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-brand-navy"
          >
            Billing
          </Link>
          <Link
            href="/dashboard/settings/integrations"
            className="block rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-brand-navy"
          >
            Integrations
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[52px] items-center justify-between border-b border-border bg-white px-6">
          <BrandSwitcher
            current={
              tenant.brand
                ? {
                    id: tenant.brand.id,
                    name: tenant.brand.name,
                    slug: tenant.brand.slug,
                  }
                : null
            }
            options={brands.map((b) => ({
              id: b.id,
              name: b.name,
              slug: b.slug,
            }))}
          />
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
