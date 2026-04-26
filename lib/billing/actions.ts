"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { requireTenant } from "@/lib/auth/tenant";
import { getPriceIdForPlan, getStripe, type PlanCycle } from "@/lib/billing/stripe";
import type { Plan } from "@prisma/client";

type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

const CheckoutInput = z.object({
  plan: z.enum(["SOLO", "BOUTIQUE", "AGENCY"]),
  cycle: z.enum(["monthly", "yearly"]),
});

/**
 * Create a Stripe Checkout session for the caller's account and redirect
 * to it. The webhook at /api/webhooks/stripe flips Account.plan + limits
 * when the session completes — we never trust the client to tell us the
 * user paid.
 *
 * Reuses `stripeCustomerId` if we have one, otherwise Stripe creates a
 * fresh customer on this session and returns the id via `customer` which
 * the webhook persists.
 */
export async function createCheckoutSession(
  input: z.input<typeof CheckoutInput>,
): Promise<ActionResult<{ url: string }>> {
  const parsed = CheckoutInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const plan = parsed.data.plan as Plan;
  const cycle = parsed.data.cycle as PlanCycle;

  const priceId = getPriceIdForPlan(plan, cycle);
  if (!priceId) {
    return {
      ok: false,
      error: `No Stripe price ID configured for ${plan}/${cycle}. Set STRIPE_PRICE_${plan}_${cycle.toUpperCase()} in .env.`,
    };
  }

  const tenant = await requireTenant();
  const account = tenant.account;

  const successUrl = `${env.APP_URL}/dashboard/settings/billing?checkout=success`;
  const cancelUrl = `${env.APP_URL}/dashboard/settings/billing?checkout=cancelled`;

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: account.id,
      // Prefer the existing customer so card-on-file persists across upgrades.
      ...(account.stripeCustomerId
        ? { customer: account.stripeCustomerId }
        : {
            customer_email:
              tenant.user.email ?? undefined,
            customer_creation: "always" as const,
          }),
      metadata: {
        accountId: account.id,
        plan,
        cycle,
      },
      subscription_data: {
        metadata: { accountId: account.id, plan, cycle },
      },
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return { ok: false, error: "Stripe did not return a checkout URL." };
    }
    return { ok: true, url: session.url };
  } catch (err) {
    console.error("createCheckoutSession failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Checkout failed.",
    };
  }
}

/**
 * Route users to Stripe Customer Portal for self-serve billing: change
 * card, cancel, switch cycle, download invoices.
 */
export async function createPortalSession(): Promise<
  ActionResult<{ url: string }>
> {
  const tenant = await requireTenant();
  if (!tenant.account.stripeCustomerId) {
    return {
      ok: false,
      error: "No Stripe customer yet — subscribe to a paid plan first.",
    };
  }
  try {
    const portal = await getStripe().billingPortal.sessions.create({
      customer: tenant.account.stripeCustomerId,
      return_url: `${env.APP_URL}/dashboard/settings/billing`,
    });
    return { ok: true, url: portal.url };
  } catch (err) {
    console.error("createPortalSession failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Portal failed.",
    };
  }
}

/** Thin wrapper — form-action-friendly. Redirects on success. */
export async function goToCheckoutOrPortal(formData: FormData) {
  const kind = String(formData.get("kind") ?? "");
  if (kind === "portal") {
    const res = await createPortalSession();
    if (!res.ok) throw new Error(res.error);
    redirect(res.url);
  }
  if (kind === "checkout") {
    const plan = String(formData.get("plan") ?? "") as Plan;
    const cycle = String(formData.get("cycle") ?? "") as PlanCycle;
    const res = await createCheckoutSession({ plan, cycle });
    if (!res.ok) throw new Error(res.error);
    redirect(res.url);
  }
  throw new Error("Unknown billing action.");
}

/**
 * Current-usage snapshot for the billing page. Reads seat + brand counts
 * so the Usage card can show them alongside the plan's limits.
 */
export async function getBillingSummary() {
  const tenant = await requireTenant();
  const [seats, brands, subscription] = await Promise.all([
    db.accountMembership.count({ where: { accountId: tenant.account.id } }),
    db.brand.count({ where: { accountId: tenant.account.id } }),
    db.subscription.findUnique({
      where: { accountId: tenant.account.id },
    }),
  ]);
  return {
    account: tenant.account,
    seats,
    brands,
    subscription,
  };
}
