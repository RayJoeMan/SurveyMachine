import { randomUUID } from "node:crypto";
import { defineBoolean } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  BillingInfoSchema,
  CreateBillingPortalInputSchema,
  CreateCheckoutInputSchema,
  type BillingInfo,
} from "../contracts";
import { safeAudit } from "../core/audit";
import { parseInput } from "../core/errors";
import { db } from "../core/firebase";
import { assertModuleEnabled, assertRole } from "../core/permissions";
import { loadPlanMonthlyUsd } from "./config.callable";
import { assertStripeConfigured, getOrCreatePlanPrice } from "./stripe";

const enforceAppCheck = defineBoolean("ENFORCE_APP_CHECK", { default: false });

const BILLING_DOC = (orgId: string) => db.doc(`organizations/${orgId}/billing/subscription`);

async function loadBilling(orgId: string): Promise<BillingInfo | undefined> {
  const snapshot = await BILLING_DOC(orgId).get();
  if (!snapshot.exists) return undefined;
  const parsed = BillingInfoSchema.safeParse(snapshot.data());
  return parsed.success ? parsed.data : undefined;
}

/**
 * Starts a Stripe Checkout subscription session for an organization's paid
 * plan. Access is org_admin (or super-admin) only; the entitlement is granted
 * exclusively by the verified webhook, never by the redirect alone.
 */
export const createCheckoutSessionV1 = onCall(
  { enforceAppCheck, cors: true, timeoutSeconds: 60 },
  async (request) => {
    const requestId = randomUUID();
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign-in is required.");
    const input = parseInput(CreateCheckoutInputSchema, request.data);
    await assertModuleEnabled(input.orgId);
    await assertRole(input.orgId, uid, ["org_admin"], request.auth?.token?.email);
    const stripe = assertStripeConfigured();

    const billing = await loadBilling(input.orgId);
    if (billing?.status === "active" || billing?.status === "trialing") {
      throw new HttpsError(
        "already-exists",
        "This organization already has an active subscription. Manage it from the billing portal.",
      );
    }
    if (input.plan === "free") {
      throw new HttpsError("invalid-argument", "Free has no checkout session.");
    }

    // Resolve or create the Stripe customer, idempotently keyed by metadata.
    let customerId = billing?.stripeCustomerId;
    if (!customerId) {
      const customers = await stripe.customers.list({
        email: request.auth?.token?.email ?? undefined,
        limit: 10,
      });
      const match = customers.data.find((customer) => customer.metadata?.sm_org === input.orgId);
      customerId = match
        ? match.id
        : (
            await stripe.customers.create({
              email: request.auth?.token?.email ?? undefined,
              name: request.auth?.token?.name ?? undefined,
              metadata: { sm_org: input.orgId },
            })
          ).id;
    }

    const monthlyUsd = await loadPlanMonthlyUsd(input.plan);
    if (monthlyUsd == null) {
      throw new HttpsError("invalid-argument", `${input.plan} has no paid price.`);
    }
    const priceId = await getOrCreatePlanPrice(stripe, input.plan, monthlyUsd);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: input.orgId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      allow_promotion_codes: true,
      subscription_data: { metadata: { sm_org: input.orgId, sm_plan: input.plan } },
      metadata: { sm_org: input.orgId, sm_plan: input.plan },
    });

    if (!session.url) {
      throw new HttpsError("internal", "Stripe did not return a checkout URL.");
    }

    await safeAudit({
      orgId: input.orgId,
      actorUid: uid,
      action: "billing.checkout_created",
      resourceType: "billing",
      resourceId: input.orgId,
      requestId,
      details: { plan: input.plan },
    });

    return { ok: true as const, requestId, url: session.url, plan: input.plan };
  },
);

/** Opens Stripe's billing portal (invoices, cards, cancellation) for the org. */
export const createBillingPortalSessionV1 = onCall(
  { enforceAppCheck, cors: true, timeoutSeconds: 60 },
  async (request) => {
    const requestId = randomUUID();
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign-in is required.");
    const input = parseInput(CreateBillingPortalInputSchema, request.data);
    await assertModuleEnabled(input.orgId);
    await assertRole(input.orgId, uid, ["org_admin"], request.auth?.token?.email);
    const stripe = assertStripeConfigured();

    const billing = await loadBilling(input.orgId);
    const customerId = billing?.stripeCustomerId;
    if (!customerId) {
      throw new HttpsError(
        "failed-precondition",
        "No Stripe customer exists for this organization yet. Start a checkout first.",
      );
    }
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: input.returnUrl,
    });

    await safeAudit({
      orgId: input.orgId,
      actorUid: uid,
      action: "billing.portal_opened",
      resourceType: "billing",
      resourceId: input.orgId,
      requestId,
      details: {},
    });

    return { ok: true as const, requestId, url: portal.url };
  },
);
