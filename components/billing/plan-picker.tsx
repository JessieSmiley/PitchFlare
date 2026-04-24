"use client";

import { useState, useTransition } from "react";
import type { Plan } from "@prisma/client";
import {
  createCheckoutSession,
  createPortalSession,
} from "@/lib/billing/actions";
import { PLAN_LABEL, PLAN_LIMITS, PLAN_MONTHLY_PRICE_USD } from "@/lib/plans";

const YEARLY_DISCOUNT = 0.1;

const PLANS: Plan[] = ["SOLO", "BOUTIQUE", "AGENCY"];

function yearlyPrice(plan: Plan): number {
  // $99/mo → $1069/yr ≈ 10% off 12×. Kept here as a display-only estimate;
  // the actual amount is whatever the Stripe price is configured for.
  return Math.round(PLAN_MONTHLY_PRICE_USD[plan] * 12 * (1 - YEARLY_DISCOUNT));
}

export function PlanPicker({
  currentPlan,
  hasStripeCustomer,
}: {
  currentPlan: Plan;
  hasStripeCustomer: boolean;
}) {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function goCheckout(plan: Plan) {
    setError(null);
    start(async () => {
      const res = await createCheckoutSession({ plan, cycle });
      if (!res.ok) setError(res.error);
      else window.location.href = res.url;
    });
  }

  function goPortal() {
    setError(null);
    start(async () => {
      const res = await createPortalSession();
      if (!res.ok) setError(res.error);
      else window.location.href = res.url;
    });
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg text-brand-navy">Plans</h2>
          <p className="text-xs text-muted-foreground">
            Upgrade, downgrade, or cancel. Yearly pricing saves ~10%.
          </p>
        </div>
        <div className="flex gap-1 rounded-full bg-muted p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setCycle("monthly")}
            className={`rounded-full px-3 py-1 ${
              cycle === "monthly"
                ? "bg-white font-medium text-brand-navy"
                : "text-muted-foreground"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setCycle("yearly")}
            className={`rounded-full px-3 py-1 ${
              cycle === "yearly"
                ? "bg-white font-medium text-brand-navy"
                : "text-muted-foreground"
            }`}
          >
            Yearly
          </button>
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => {
          const limits = PLAN_LIMITS[p];
          const price =
            cycle === "monthly"
              ? PLAN_MONTHLY_PRICE_USD[p]
              : yearlyPrice(p);
          const isCurrent = p === currentPlan;
          return (
            <div
              key={p}
              className={`rounded-lg border p-5 ${
                isCurrent ? "border-brand-pink ring-2 ring-accent" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl text-brand-navy">
                  {PLAN_LABEL[p]}
                </h3>
                {isCurrent && (
                  <span className="rounded-full bg-brand-pink px-2 py-0.5 text-[10px] text-white">
                    Current
                  </span>
                )}
              </div>
              <div className="mt-2 font-display text-3xl text-brand-navy">
                ${price.toLocaleString()}
                <span className="ml-1 text-sm text-muted-foreground">
                  /{cycle === "monthly" ? "mo" : "yr"}
                </span>
              </div>
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                <li>
                  {limits.maxSeats} seat{limits.maxSeats === 1 ? "" : "s"}
                </li>
                <li>
                  {limits.maxBrands} brand{limits.maxBrands === 1 ? "" : "s"}
                </li>
                {limits.coupled && (
                  <li className="text-[10px] italic">
                    seats × brands ≤ {limits.seatsBrandsProduct}
                  </li>
                )}
              </ul>
              <button
                type="button"
                onClick={() => (isCurrent && hasStripeCustomer ? goPortal() : goCheckout(p))}
                disabled={pending}
                className={`mt-4 w-full rounded-full px-3 py-2 text-xs ${
                  isCurrent
                    ? "border border-border hover:border-brand-pink"
                    : "bg-brand-pink text-white hover:opacity-90"
                } disabled:opacity-60`}
              >
                {pending
                  ? "Working…"
                  : isCurrent
                    ? hasStripeCustomer
                      ? "Manage in portal"
                      : "Current plan"
                    : "Switch to this plan"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function PortalButton() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await createPortalSession();
            if (!res.ok) setError(res.error);
            else window.location.href = res.url;
          })
        }
        className="rounded-full border border-border px-3 py-1 text-xs hover:border-brand-pink disabled:opacity-60"
      >
        {pending ? "Opening…" : "Open billing portal"}
      </button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </>
  );
}
