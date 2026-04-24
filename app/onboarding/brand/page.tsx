import { redirect } from "next/navigation";
import { getTenant } from "@/lib/auth/tenant";
import { createFirstBrandAndGoToDashboard } from "@/lib/auth/actions";
import { PLAN_LABEL, PLAN_LIMITS } from "@/lib/plans";

export default async function OnboardingBrandPage() {
  const tenant = await getTenant();
  if (!tenant) redirect("/onboarding");

  // Already has a brand → shortcut straight to dashboard.
  if (tenant.brand) redirect("/dashboard");

  const limits = PLAN_LIMITS[tenant.account.plan];

  return (
    <div>
      <h1 className="font-display text-2xl text-brand-navy">
        Create your first brand
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Each brand is an isolated workspace — its own voice, contacts,
        campaigns, and reports. You&apos;re on the{" "}
        <span className="font-medium text-brand-navy">
          {PLAN_LABEL[tenant.account.plan]}
        </span>{" "}
        plan, which allows {limits.maxBrands}{" "}
        {limits.maxBrands === 1 ? "brand" : "brands"}.
      </p>

      <form action={createFirstBrandAndGoToDashboard} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-brand-navy">
            Brand name
            <input
              name="name"
              required
              maxLength={80}
              className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              placeholder="e.g. Acme Fintech"
            />
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-navy">
            Website <span className="text-muted-foreground">(optional)</span>
            <input
              name="website"
              type="url"
              className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              placeholder="https://acme.com"
            />
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-navy">
            Category <span className="text-muted-foreground">(optional)</span>
            <input
              name="category"
              maxLength={60}
              className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              placeholder="e.g. SaaS, Consumer, Healthcare"
            />
          </label>
        </div>

        <button
          type="submit"
          className="w-full rounded-full bg-brand-pink px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Create brand and continue →
        </button>
      </form>
    </div>
  );
}
