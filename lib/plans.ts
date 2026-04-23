/**
 * Plan definitions. Single source of truth for tier limits, display names,
 * and Stripe price lookup keys.
 *
 * Boutique is the only plan with a coupled constraint:
 *   seats_used * brands_used <= 3  (with each dimension capped at 3)
 * So the pair (1 seat, 3 brands) and (3 seats, 1 brand) both fit, but
 * (2 seats, 2 brands) = 4 does NOT. This matches SPEC.md §2.
 */

import type { Plan } from "@prisma/client";

export type PlanLimits = {
  /** Hard cap on seats regardless of other dimensions. */
  maxSeats: number;
  /** Hard cap on brands regardless of other dimensions. */
  maxBrands: number;
  /** If true, `seats * brands <= seatsBrandsProduct` also applies. */
  coupled: boolean;
  /** Only relevant when `coupled` is true. */
  seatsBrandsProduct?: number;
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  SOLO: { maxSeats: 1, maxBrands: 1, coupled: false },
  BOUTIQUE: {
    maxSeats: 3,
    maxBrands: 3,
    coupled: true,
    seatsBrandsProduct: 3,
  },
  AGENCY: { maxSeats: 5, maxBrands: 10, coupled: false },
};

export const PLAN_LABEL: Record<Plan, string> = {
  SOLO: "Solo",
  BOUTIQUE: "Boutique",
  AGENCY: "Agency",
};

export const PLAN_MONTHLY_PRICE_USD: Record<Plan, number> = {
  SOLO: 99,
  BOUTIQUE: 249,
  AGENCY: 499,
};

/** Stripe lookup keys (env variable names, not values). */
export const PLAN_STRIPE_ENV: Record<
  Plan,
  { monthly: string; yearly: string }
> = {
  SOLO: {
    monthly: "STRIPE_PRICE_SOLO_MONTHLY",
    yearly: "STRIPE_PRICE_SOLO_YEARLY",
  },
  BOUTIQUE: {
    monthly: "STRIPE_PRICE_BOUTIQUE_MONTHLY",
    yearly: "STRIPE_PRICE_BOUTIQUE_YEARLY",
  },
  AGENCY: {
    monthly: "STRIPE_PRICE_AGENCY_MONTHLY",
    yearly: "STRIPE_PRICE_AGENCY_YEARLY",
  },
};

export type LimitCheck =
  | { ok: true }
  | { ok: false; reason: string; code: "SEAT_LIMIT" | "BRAND_LIMIT" | "COUPLED_LIMIT" };

/**
 * Can we add one more brand without exceeding the plan's limits?
 *
 * @param plan - current plan
 * @param seats - seats currently in use (count of AccountMembership rows)
 * @param brands - brands currently created (count of Brand rows)
 */
export function canAddBrand(
  plan: Plan,
  seats: number,
  brands: number,
): LimitCheck {
  const l = PLAN_LIMITS[plan];
  const next = brands + 1;
  if (next > l.maxBrands) {
    return {
      ok: false,
      code: "BRAND_LIMIT",
      reason: `The ${PLAN_LABEL[plan]} plan allows up to ${l.maxBrands} ${
        l.maxBrands === 1 ? "brand" : "brands"
      }.`,
    };
  }
  if (l.coupled && l.seatsBrandsProduct && seats * next > l.seatsBrandsProduct) {
    return {
      ok: false,
      code: "COUPLED_LIMIT",
      reason: `The ${PLAN_LABEL[plan]} plan allows either 1 seat with 3 brands, 3 seats with 1 brand, or anything in between (seats × brands ≤ 3). You currently have ${seats} seat${seats === 1 ? "" : "s"} and ${brands} brand${brands === 1 ? "" : "s"}.`,
    };
  }
  return { ok: true };
}

export function canAddSeat(
  plan: Plan,
  seats: number,
  brands: number,
): LimitCheck {
  const l = PLAN_LIMITS[plan];
  const next = seats + 1;
  if (next > l.maxSeats) {
    return {
      ok: false,
      code: "SEAT_LIMIT",
      reason: `The ${PLAN_LABEL[plan]} plan allows up to ${l.maxSeats} ${
        l.maxSeats === 1 ? "seat" : "seats"
      }.`,
    };
  }
  if (l.coupled && l.seatsBrandsProduct && next * brands > l.seatsBrandsProduct) {
    return {
      ok: false,
      code: "COUPLED_LIMIT",
      reason: `The ${PLAN_LABEL[plan]} plan requires seats × brands ≤ 3. You currently have ${seats} seat${seats === 1 ? "" : "s"} and ${brands} brand${brands === 1 ? "" : "s"}.`,
    };
  }
  return { ok: true };
}
