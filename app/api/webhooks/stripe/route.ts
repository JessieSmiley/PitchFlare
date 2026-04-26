import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  getStripe,
  limitsForPlan,
  resolvePriceIdToPlan,
} from "@/lib/billing/stripe";
import type { Plan, SubscriptionStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook. Trusts only events it can verify with the signing
 * secret — any unverified POST gets 401.
 *
 * We subscribe narrowly in the Stripe dashboard to:
 *   - checkout.session.completed
 *   - customer.subscription.created
 *   - customer.subscription.updated
 *   - customer.subscription.deleted
 *   - invoice.payment_failed
 *
 * Every handler is idempotent — Stripe retries on 5xx and we mustn't
 * double-apply a plan change.
 */
export async function POST(req: Request) {
  const signature = (await headers()).get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("Stripe webhook signature check failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpsert(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        // Events we don't care about are acknowledged so Stripe stops retrying.
        break;
    }
  } catch (err) {
    console.error(`Stripe webhook handler failed on ${event.type}:`, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const accountId = (session.client_reference_id ?? session.metadata?.accountId) as
    | string
    | undefined;
  if (!accountId) {
    console.warn("checkout.session.completed without accountId");
    return;
  }
  const customerId = typeof session.customer === "string" ? session.customer : null;
  if (customerId) {
    await db.account.update({
      where: { id: accountId },
      data: { stripeCustomerId: customerId },
    });
  }
  // The subscription.created event that follows handles plan + limits —
  // we just make sure the customer id is linked so future lookups resolve.
}

async function handleSubscriptionUpsert(sub: Stripe.Subscription) {
  const accountId =
    (typeof sub.metadata?.accountId === "string" && sub.metadata.accountId) ||
    (await resolveAccountByCustomerId(
      typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    ));
  if (!accountId) {
    console.warn("subscription webhook without resolvable accountId");
    return;
  }

  // Find the priceId on the primary line item to determine which plan.
  const priceId = sub.items.data[0]?.price.id;
  const resolved = priceId ? resolvePriceIdToPlan(priceId) : null;
  const plan: Plan = resolved?.plan ?? "SOLO";
  const { seatLimit, brandLimit } = limitsForPlan(plan);
  const status = mapStripeStatus(sub.status);

  await db.$transaction([
    db.account.update({
      where: { id: accountId },
      data: { plan, seatLimit, brandLimit },
    }),
    db.subscription.upsert({
      where: { accountId },
      create: {
        accountId,
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId ?? "unknown",
        status,
        currentPeriodStart: new Date(sub.current_period_start * 1000),
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
      },
      update: {
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId ?? "unknown",
        status,
        currentPeriodStart: new Date(sub.current_period_start * 1000),
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
      },
    }),
  ]);
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const accountId =
    (typeof sub.metadata?.accountId === "string" && sub.metadata.accountId) ||
    (await resolveAccountByCustomerId(
      typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    ));
  if (!accountId) return;

  // Canceled — drop the plan back to SOLO limits. We don't delete the
  // Subscription row; the CANCELED status + canceledAt timestamp is the
  // source of truth for "used to be on X".
  const { seatLimit, brandLimit } = limitsForPlan("SOLO");
  await db.$transaction([
    db.account.update({
      where: { id: accountId },
      data: { plan: "SOLO", seatLimit, brandLimit },
    }),
    db.subscription.update({
      where: { accountId },
      data: {
        status: "CANCELED",
        canceledAt: sub.canceled_at
          ? new Date(sub.canceled_at * 1000)
          : new Date(),
      },
    }),
  ]);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;
  const accountId = await resolveAccountByCustomerId(customerId);
  if (!accountId) return;

  await db.subscription.updateMany({
    where: { accountId },
    data: { status: "PAST_DUE" },
  });
}

async function resolveAccountByCustomerId(
  customerId: string,
): Promise<string | null> {
  const acc = await db.account.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  return acc?.id ?? null;
}

function mapStripeStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  switch (s) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
      return "CANCELED";
    case "incomplete":
      return "INCOMPLETE";
    case "incomplete_expired":
      return "INCOMPLETE_EXPIRED";
    case "unpaid":
      return "UNPAID";
    case "paused":
      return "PAUSED";
    default:
      return "INCOMPLETE";
  }
}
