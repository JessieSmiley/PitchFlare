/**
 * One-shot script that provisions PitchFlare's Stripe products and prices,
 * then prints the `STRIPE_PRICE_*` env values to paste into .env.local.
 *
 * Idempotent — reuses existing products matched by name.
 *
 * Usage:
 *   pnpm tsx scripts/setup-stripe-products.ts
 *
 * Requires STRIPE_SECRET_KEY in the environment (test mode or live).
 */
import Stripe from "stripe";

const PLANS: Array<{
  key: "SOLO" | "BOUTIQUE" | "AGENCY";
  name: string;
  monthly: number; // USD
  yearly: number; // USD
  description: string;
}> = [
  {
    key: "SOLO",
    name: "PitchFlare Solo",
    monthly: 9900,
    yearly: 106900,
    description: "1 seat · 1 brand. For freelance PR consultants.",
  },
  {
    key: "BOUTIQUE",
    name: "PitchFlare Boutique",
    monthly: 24900,
    yearly: 268900,
    description:
      "1 seat / 3 brands or 3 seats / 1 brand. For boutique PR shops.",
  },
  {
    key: "AGENCY",
    name: "PitchFlare Agency",
    monthly: 49900,
    yearly: 538900,
    description: "5 seats · 10 brands. For small-to-mid PR agencies.",
  },
];

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("STRIPE_SECRET_KEY is not set.");
    process.exit(1);
  }
  const stripe = new Stripe(key, { apiVersion: "2024-12-18.acacia" });

  const out: string[] = [];

  for (const plan of PLANS) {
    // Find or create product.
    const existing = await stripe.products.search({
      query: `name:"${plan.name}"`,
    });
    let product =
      existing.data[0] ??
      (await stripe.products.create({
        name: plan.name,
        description: plan.description,
        metadata: { plan: plan.key },
      }));
    if (product.description !== plan.description) {
      product = await stripe.products.update(product.id, {
        description: plan.description,
      });
    }

    const [monthly, yearly] = await Promise.all([
      ensurePrice(stripe, product.id, plan.monthly, "month", plan.key),
      ensurePrice(stripe, product.id, plan.yearly, "year", plan.key),
    ]);

    out.push(
      `STRIPE_PRICE_${plan.key}_MONTHLY=${monthly.id}`,
      `STRIPE_PRICE_${plan.key}_YEARLY=${yearly.id}`,
    );
    console.log(`✓ ${plan.name}: monthly ${monthly.id}, yearly ${yearly.id}`);
  }

  console.log("\nPaste these into .env.local:\n");
  console.log(out.join("\n"));
}

async function ensurePrice(
  stripe: Stripe,
  productId: string,
  unitAmount: number,
  interval: "month" | "year",
  planKey: string,
): Promise<Stripe.Price> {
  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 100,
  });
  const match = prices.data.find(
    (p) =>
      p.currency === "usd" &&
      p.unit_amount === unitAmount &&
      p.recurring?.interval === interval,
  );
  if (match) return match;
  return stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: unitAmount,
    recurring: { interval },
    metadata: { plan: planKey, cycle: interval === "month" ? "monthly" : "yearly" },
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
