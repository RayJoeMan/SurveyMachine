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
 * Resolves a monthly Stripe price for a plan at the given amount, creating the
 * product + price as needed (idempotent via product metadata `sm_plan`).
 * Stripe prices are immutable, so when the platform price changes a NEW price
 * is created for future checkouts; existing subscriptions keep their price.
 * Prices are only ever created server-side.
 */
export async function getOrCreatePlanPrice(
  stripe: Stripe,
  plan: BillingPlan,
  monthlyUsd: number,
): Promise<string> {
  const unitAmount = monthlyUsd * 100;
  const cacheKey = `${plan}:${unitAmount}`;
  const cached = priceCache.get(cacheKey);
  if (cached && Date.now() - cached.at < PRICE_CACHE_TTL_MS) return cached.priceId;

  const existing = await stripe.products
    .list({ limit: 100, active: true })
    .then((result) => result.data.find((product) => product.metadata?.sm_plan === plan));
  if (existing) {
    const price = await stripe.prices
      .list({ product: existing.id, limit: 100, active: true })
      .then((result) =>
        result.data.find(
          (entry) =>
            entry.type === "recurring" &&
            entry.recurring?.interval === "month" &&
            entry.unit_amount === unitAmount,
        ),
      );
    if (price) {
      priceCache.set(cacheKey, { priceId: price.id, at: Date.now() });
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
    unit_amount: unitAmount,
    recurring: { interval: "month" },
    metadata: { sm_plan: plan },
  });
  priceCache.set(cacheKey, { priceId: created.id, at: Date.now() });
  return created.id;
}
