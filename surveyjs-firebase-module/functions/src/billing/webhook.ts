import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import type Stripe from "stripe";
import { BillingPlanSchema, type BillingPlan, type BillingStatus } from "../contracts";
import { db } from "../core/firebase";
import { getStripe } from "./stripe";

const HANDLED_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
]);

/** Maps a Stripe subscription status to the compact platform status. */
export function normalizeSubscriptionStatus(status: Stripe.Subscription.Status): BillingStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "incomplete":
      return "incomplete";
    default:
      return "canceled";
  }
}

/**
 * Stripe v22 typings omit current_period_end from Subscription; the field is
 * present on the live API, so read it through a narrow structural type.
 */
function subscriptionCurrentPeriodEnd(subscription: unknown): number | null {
  const value = (subscription as { current_period_end?: number | null } | null | undefined)
    ?.current_period_end;
  return value ?? null;
}

export function planFromMetadata(metadata: Stripe.Metadata | undefined): BillingPlan | null {
  const plan = metadata?.sm_plan;
  if (!plan) return null;
  const parsed = BillingPlanSchema.safeParse(plan);
  return parsed.success ? parsed.data : null;
}

export function entitlementEnabled(status: BillingStatus): boolean {
  return status === "active" || status === "trialing";
}

async function writeReceipt(eventId: string, eventType: string): Promise<boolean> {
  const receiptRef = db.doc(`billingEvents/${eventId}`);
  try {
    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(receiptRef);
      if (existing.exists) return;
      transaction.set(receiptRef, {
        eventType,
        processedAt: FieldValue.serverTimestamp(),
      });
    });
    return true;
  } catch {
    return false;
  }
}

interface ReconcileInput {
  orgId: string;
  plan: BillingPlan;
  status: BillingStatus;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  currentPeriodEnd: number | null;
  eventId: string;
  eventType: string;
}

/** Writes the billing document and flips the module entitlement accordingly. */
export async function reconcileSubscription(input: ReconcileInput): Promise<void> {
  const orgRef = db.doc(`organizations/${input.orgId}`);
  const billingRef = db.doc(`organizations/${input.orgId}/billing/subscription`);
  const entitlementRef = db.doc(`organizations/${input.orgId}/moduleEntitlements/surveys`);

  await db.runTransaction(async (transaction) => {
    const org = await transaction.get(orgRef);
    if (!org.exists) {
      throw new Error(`Billing event for unknown org ${input.orgId}`);
    }
    transaction.set(billingRef, {
      orgId: input.orgId,
      plan: input.plan,
      status: input.status,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      currentPeriodEnd: input.currentPeriodEnd
        ? new Date(input.currentPeriodEnd * 1000).toISOString()
        : null,
      updatedBy: "stripe-webhook",
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(
      entitlementRef,
      {
        enabled: entitlementEnabled(input.status),
        plan: input.plan,
        billingStatus: input.status,
        updatedBy: "stripe-webhook",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  await safeAuditWebhook(input);
}

async function safeAuditWebhook(input: ReconcileInput): Promise<void> {
  try {
    await db.collection(`organizations/${input.orgId}/auditLogs`).add({
      actorUid: "stripe-webhook",
      action: "billing.reconciled",
      resourceType: "billing",
      resourceId: input.orgId,
      requestId: input.eventId,
      details: {
        eventType: input.eventType,
        plan: input.plan,
        status: input.status,
        subscriptionId: input.stripeSubscriptionId,
      },
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    logger.error("Webhook audit write failed", { eventId: input.eventId, error });
  }
}

/** Core event router; exported separately for unit tests. */
export async function handleStripeEvent(stripe: Stripe, event: Stripe.Event): Promise<void> {
  const eventId = event.id;
  const received = await writeReceipt(eventId, event.type);
  if (!received) {
    logger.info("Duplicate Stripe event skipped", { eventId });
    return;
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription" || !session.subscription) return;
      const orgId = session.metadata?.sm_org;
      const plan = planFromMetadata(session.metadata ?? undefined);
      if (!orgId || !plan) {
        logger.warn("Checkout event missing org/plan metadata; not reconciling", { eventId });
        return;
      }
      const subscription = await stripe.subscriptions.retrieve(
        typeof session.subscription === "string" ? session.subscription : session.subscription.id,
      );
      await reconcileSubscription({
        orgId,
        plan,
        status: normalizeSubscriptionStatus(subscription.status),
        stripeCustomerId:
          typeof session.customer === "string" ? session.customer : (session.customer?.id ?? ""),
        stripeSubscriptionId: subscription.id,
        currentPeriodEnd: subscriptionCurrentPeriodEnd(subscription),
        eventId,
        eventType: event.type,
      });
      return;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const orgId = subscription.metadata?.sm_org;
      const plan =
        planFromMetadata(subscription.metadata) ??
        planFromMetadata(subscription.items.data[0]?.price?.metadata);
      if (!orgId || !plan) {
        logger.warn("Subscription event missing org/plan metadata; not reconciling", {
          eventId,
        });
        return;
      }
      const status =
        event.type === "customer.subscription.deleted"
          ? "canceled"
          : normalizeSubscriptionStatus(subscription.status);
      await reconcileSubscription({
        orgId,
        plan,
        status,
        stripeCustomerId:
          typeof subscription.customer === "string"
            ? subscription.customer
            : (subscription.customer?.id ?? ""),
        stripeSubscriptionId: subscription.id,
        currentPeriodEnd: subscriptionCurrentPeriodEnd(subscription),
        eventId,
        eventType: event.type,
      });
      return;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice & {
        subscription?: string | { id: string } | null;
      };
      const subscriptionId =
        typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
      if (!subscriptionId) return;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const orgId = subscription.metadata?.sm_org;
      const plan =
        planFromMetadata(subscription.metadata) ??
        planFromMetadata(subscription.items.data[0]?.price?.metadata);
      if (!orgId || !plan) return;
      await reconcileSubscription({
        orgId,
        plan,
        status: "past_due",
        stripeCustomerId:
          typeof subscription.customer === "string"
            ? subscription.customer
            : (subscription.customer?.id ?? ""),
        stripeSubscriptionId: subscription.id,
        currentPeriodEnd: subscriptionCurrentPeriodEnd(subscription),
        eventId,
        eventType: event.type,
      });
      return;
    }

    default:
      return;
  }
}

/**
 * Stripe webhook endpoint. Validates the signature against
 * STRIPE_WEBHOOK_SECRET, then reconciles billing/entitlements. Returns quickly;
 * idempotency is enforced by the per-event receipt.
 */
export const stripeWebhookV1 = onRequest(
  { timeoutSeconds: 60, memory: "256MiB" },
  async (request, response) => {
    // Comma-separated so live-mode and test-mode endpoint secrets can coexist.
    const secrets = (process.env.STRIPE_WEBHOOK_SECRET ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    const stripe = getStripe();
    if (secrets.length === 0 || !stripe) {
      response.status(503).json({ error: "Stripe webhook is not configured." });
      return;
    }
    const signature = request.headers["stripe-signature"];
    if (typeof signature !== "string") {
      response.status(400).json({ error: "Missing Stripe signature." });
      return;
    }
    if (!request.rawBody) {
      response.status(400).json({ error: "Missing request body." });
      return;
    }

    let event: Stripe.Event | undefined;
    let lastError: unknown;
    for (const secret of secrets) {
      try {
        event = stripe.webhooks.constructEvent(request.rawBody, signature, secret);
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!event) {
      logger.warn("Stripe webhook signature verification failed", { error: lastError });
      response.status(400).json({ error: "Invalid Stripe signature." });
      return;
    }

    if (!HANDLED_EVENTS.has(event.type)) {
      response.status(200).json({ received: true, skipped: event.type });
      return;
    }

    try {
      await handleStripeEvent(stripe, event);
      response.status(200).json({ received: true });
    } catch (error) {
      logger.error("Stripe webhook handling failed", { type: event.type, error });
      response.status(500).json({ error: "Webhook processing failed." });
    }
  },
);
