import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { getTenant, listAccessibleBrands } from "@/lib/auth/tenant";
import { BrandSwitcher } from "@/components/brand-switcher";
import { KeyboardShortcuts } from "@/components/shortcuts/keyboard-shortcuts";

export const dynamic = "force-dynamic";

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
    <div className="flex min-h-screen bg-brand-mist">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-pink focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to main content
      </a>
      <KeyboardShortcuts />
      <aside className="flex w-[230px] shrink-0 flex-col border-r border-slate-200 bg-white">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-4 py-4">
          <Image
            src="/logo-mark.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8"
            priority
          />
          <span className="text-lg font-bold tracking-tight text-brand-navy">
            PitchFlare
          </span>
        </Link>

        <nav className="flex flex-col gap-0.5 px-2 py-2 text-sm">
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

        <div className="mt-auto border-t border-slate-200 px-2 py-3">
          <Link
            href="/dashboard/settings/billing"
            className="block rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-brand-mist hover:text-brand-navy"
          >
            Billing
          </Link>
          <Link
            href="/dashboard/settings/integrations"
            className="block rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-brand-mist hover:text-brand-navy"
          >
            Integrations
          </Link>
          <Link
            href="/dashboard/help"
            className="block rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-brand-mist hover:text-brand-navy"
          >
            Help
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
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
              className="rounded-lg bg-brand-pink px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-pink-deep"
            >
              ✦ Write pitch
            </Link>
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>
        <main id="main-content" className="flex-1 overflow-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavItem({ href, n, label }: { href: string; n: number; label: string }) {
  return (
    <Link
      href={href}
      className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2 text-brand-navy transition-colors hover:bg-brand-mist first:mt-0"
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-navy text-xs font-bold text-white">
        {n}
      </span>
      <span className="font-semibold">{label}</span>
    </Link>
  );
}

function NavSub({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="ml-9 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-brand-mist hover:text-brand-navy"
    >
      {label}
    </Link>
  );
}
