import Stripe from "stripe";
import { env } from "@/lib/env";
import { PLAN_LIMITS, PLAN_STRIPE_ENV } from "@/lib/plans";
import type { Plan } from "@prisma/client";

const globalForStripe = globalThis as unknown as { stripe: Stripe | undefined };

// Lazy init: defers env access to request time so `next build` can collect
// page data without STRIPE_SECRET_KEY present in the build environment.
export function getStripe(): Stripe {
  if (!globalForStripe.stripe) {
    globalForStripe.stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      // Pin the API version so Stripe's behavior is stable even after they
      // roll new defaults. Update deliberately when we want new features.
      // Cast: SDK types only allow its bundled latest version literal, but
      // older valid versions are still accepted at runtime by the Stripe API.
      apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
      typescript: true,
    });
  }
  return globalForStripe.stripe;
}

/** Maps Stripe price IDs back to our internal Plan + billing cycle. */
export type PlanCycle = "monthly" | "yearly";

export function getPriceIdForPlan(plan: Plan, cycle: PlanCycle): string | null {
  const envName = PLAN_STRIPE_ENV[plan][cycle];
  return process.env[envName] ?? null;
}

/**
 * Reverse lookup: given the Stripe price id we saw on a subscription,
 * figure out which (plan, cycle) it was. Returns null when the price
 * isn't configured — we fall through to the user's current plan then.
 */
export function resolvePriceIdToPlan(
  priceId: string,
): { plan: Plan; cycle: PlanCycle } | null {
  const plans: Plan[] = ["SOLO", "BOUTIQUE", "AGENCY"];
  for (const plan of plans) {
    for (const cycle of ["monthly", "yearly"] as const) {
      if (getPriceIdForPlan(plan, cycle) === priceId) {
        return { plan, cycle };
      }
    }
  }
  return null;
}

/**
 * On every plan change (new sub, upgrade, downgrade, cancel) we want
 * seat + brand limits to stay in sync with the tier the customer is
 * actually on. This returns the right pair for a given plan.
 */
export function limitsForPlan(plan: Plan): {
  seatLimit: number;
  brandLimit: number;
} {
  const l = PLAN_LIMITS[plan];
  return { seatLimit: l.maxSeats, brandLimit: l.maxBrands };
}
