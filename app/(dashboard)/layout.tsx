import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { getTenant, listAccessibleBrands } from "@/lib/auth/tenant";
import { BrandSwitcher } from "@/components/brand-switcher";
import { KeyboardShortcuts } from "@/components/shortcuts/keyboard-shortcuts";
import { SidebarNav } from "@/components/nav/sidebar-nav";
import { db } from "@/lib/db";
import { canAddBrand, PLAN_LABEL } from "@/lib/plans";

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

  const [brands, seatCount, brandCount, campaigns] = await Promise.all([
    listAccessibleBrands(tenant.account.id, tenant.user.id),
    db.accountMembership.count({ where: { accountId: tenant.account.id } }),
    db.brand.count({ where: { accountId: tenant.account.id } }),
    db.campaign.findMany({
      where: { brandId: tenant.brand.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true },
    }),
  ]);

  const brandRoom = canAddBrand(tenant.account.plan, seatCount, brandCount);
  const brandCreation = {
    canAdd: brandRoom.ok,
    reason: brandRoom.ok ? null : brandRoom.reason,
    planLabel: PLAN_LABEL[tenant.account.plan],
  };

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

        <SidebarNav
          brands={brands.map((b) => ({ id: b.id, name: b.name, slug: b.slug }))}
          currentBrandId={tenant.brand?.id ?? null}
          campaigns={campaigns}
          brandCreation={brandCreation}
        />

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
