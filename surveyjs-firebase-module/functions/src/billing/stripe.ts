import Stripe from "stripe";
import { HttpsError } from "firebase-functions/v2/https";
import { BILLING_PLAN_DETAILS, type BillingPlan } from "../contracts";

let client: Stripe | null | undefined;

/**
 * Lazily creates the Stripe client from the server-side secret. Returns null
 * when STRIPE_SECRET_KEY is unset so the rest of the app fails with a clear
 * "not configured" error instead of crashing.
 */
export function getStripe(): Stripe | null {
  if (client !== undefined) return client;
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    client = null;
    return client;
  }
  client = new Stripe(secretKey, { maxNetworkRetries: 2 });
  return client;
}

export function assertStripeConfigured(): Stripe {
  const stripe = getStripe();
  if (!stripe) {
    throw new HttpsError(
      "failed-precondition",
      "Payments are not configured yet. The operator must set STRIPE_SECRET_KEY.",
    );
  }
  return stripe;
}

const PRICE_CACHE_TTL_MS = 5 * 60_000;
const priceCache = new Map<string, { priceId: string; at: number }>();

/**
 * Resolves a monthly Stripe price for a plan, creating the product + price
 * once and reusing it across calls (idempotent via product metadata key
 * `sm_plan`). Prices are only ever created server-side.
 */
export async function getOrCreatePlanPrice(stripe: Stripe, plan: BillingPlan): Promise<string> {
  const monthlyUsd = BILLING_PLAN_DETAILS[plan].monthlyUsd;
  if (monthlyUsd == null) {
    throw new HttpsError("invalid-argument", `${plan} has no paid price.`);
  }

  const cached = priceCache.get(plan);
  if (cached && Date.now() - cached.at < PRICE_CACHE_TTL_MS) return cached.priceId;

  const existing = await stripe.products
    .list({ limit: 100, active: true })
    .then((result) => result.data.find((product) => product.metadata?.sm_plan === plan));
  if (existing) {
    const price = await stripe.prices
      .list({ product: existing.id, limit: 100, active: true })
      .then((result) =>
        result.data.find(
          (entry) => entry.type === "recurring" && entry.recurring?.interval === "month",
        ),
      );
    if (price) {
      priceCache.set(plan, { priceId: price.id, at: Date.now() });
      return price.id;
    }
  }

  const product =
    existing ??
    (await stripe.products.create({
      name: `Survey Machine ${BILLING_PLAN_DETAILS[plan].label}`,
      metadata: { sm_plan: plan },
    }));
  const created = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: monthlyUsd * 100,
    recurring: { interval: "month" },
    metadata: { sm_plan: plan },
  });
  priceCache.set(plan, { priceId: created.id, at: Date.now() });
  return created.id;
}
