import { getBillingSummary } from "@/lib/billing/actions";
import { PlanPicker, PortalButton } from "@/components/billing/plan-picker";
import { PLAN_LABEL, PLAN_LIMITS, canAddBrand, canAddSeat } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const summary = await getBillingSummary();
  const params = await searchParams;
  const limits = PLAN_LIMITS[summary.account.plan];
  const brandRoom = canAddBrand(summary.account.plan, summary.seats, summary.brands);
  const seatRoom = canAddSeat(summary.account.plan, summary.seats, summary.brands);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl text-brand-navy">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Plan, usage, invoices. Billing is handled by Stripe — upgrades
          open Checkout, the Portal handles everything else.
        </p>
      </div>

      {params.checkout === "success" && (
        <div className="rounded-md border border-brand-pink bg-accent px-4 py-3 text-sm text-brand-navy">
          Checkout completed. Your plan will update within a few seconds as
          the Stripe webhook reconciles the subscription.
        </div>
      )}
      {params.checkout === "cancelled" && (
        <div className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          Checkout cancelled. No changes made.
        </div>
      )}

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg text-brand-navy">
              Current plan
            </h2>
            <p className="text-xs text-muted-foreground">
              Account: <span className="text-brand-navy">{summary.account.name}</span>
            </p>
          </div>
          <div className="text-right">
            <div className="rounded-full bg-brand-pink px-3 py-1 text-xs text-white">
              {PLAN_LABEL[summary.account.plan]}
            </div>
            {summary.subscription && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                {summary.subscription.status}
                {summary.subscription.cancelAtPeriodEnd && " · cancels at period end"}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <UsageRow
            label="Seats"
            used={summary.seats}
            cap={limits.maxSeats}
            note={seatRoom.ok ? "Room for more" : seatRoom.reason}
            okToAdd={seatRoom.ok}
          />
          <UsageRow
            label="Brands"
            used={summary.brands}
            cap={limits.maxBrands}
            note={brandRoom.ok ? "Room for more" : brandRoom.reason}
            okToAdd={brandRoom.ok}
          />
        </div>

        {summary.account.stripeCustomerId && (
          <div className="mt-4 flex justify-end">
            <PortalButton />
          </div>
        )}
      </section>

      <PlanPicker
        currentPlan={summary.account.plan}
        hasStripeCustomer={Boolean(summary.account.stripeCustomerId)}
      />
    </div>
  );
}

function UsageRow({
  label,
  used,
  cap,
  note,
  okToAdd,
}: {
  label: string;
  used: number;
  cap: number;
  note: string;
  okToAdd: boolean;
}) {
  const pct = cap === 0 ? 0 : Math.min(100, Math.round((used / cap) * 100));
  return (
    <div className="rounded-md border border-border bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="font-display text-lg text-brand-navy">
          {used} / {cap}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full ${okToAdd ? "bg-brand-pink" : "bg-destructive"}`}
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>
      <p
        className={`mt-1 text-[10px] ${okToAdd ? "text-muted-foreground" : "text-destructive"}`}
      >
        {note}
      </p>
    </div>
  );
}
