import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { defineBoolean } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  DEFAULT_PLAN_MONTHLY_USD,
  UpdatePlanPricingInputSchema,
  type BillingPlan,
} from "../contracts";
import { parseInput } from "../core/errors";
import { db } from "../core/firebase";
import { assertSuperAdmin } from "../core/permissions";

const enforceAppCheck = defineBoolean("ENFORCE_APP_CHECK", { default: false });

const CONFIG_DOC = () => db.doc("platform/billingConfig");

/**
 * Loads the platform-configured monthly USD amount for a plan, falling back to
 * the default catalog amounts when the platform has not overridden them.
 */
export async function loadPlanMonthlyUsd(plan: BillingPlan): Promise<number | null> {
  const fallback = DEFAULT_PLAN_MONTHLY_USD[plan];
  if (plan === "free") return null;
  try {
    const snapshot = await CONFIG_DOC().get();
    if (!snapshot.exists) return fallback;
    const amount = snapshot.get(plan);
    return typeof amount === "number" && Number.isFinite(amount) && amount > 0 ? amount : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Platform-level pricing override for the Pro and Enterprise plans. Restricted
 * to verified super-admin accounts; writes the shared `platform/billingConfig`
 * document that the checkout flow reads. Client writes are denied by rules.
 */
export const updatePlanPricingV1 = onCall({ enforceAppCheck, cors: true }, async (request) => {
  const requestId = randomUUID();
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign-in is required.");
  assertSuperAdmin(request.auth?.token?.email);
  const input = parseInput(UpdatePlanPricingInputSchema, request.data);

  await CONFIG_DOC().set(
    {
      pro: input.pro,
      enterprise: input.enterprise,
      updatedBy: uid,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  try {
    await db.collection("platform/auditLogs").add({
      actorUid: uid,
      action: "billing.pricing_updated",
      resourceType: "platform",
      resourceId: "billingConfig",
      requestId,
      details: { pro: input.pro, enterprise: input.enterprise },
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    // Auditing must never fail the pricing update.
    console.error("Pricing audit write failed", { requestId, error });
  }

  return {
    ok: true as const,
    requestId,
    pro: input.pro,
    enterprise: input.enterprise,
  };
});
