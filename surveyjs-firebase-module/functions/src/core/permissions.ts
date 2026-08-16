import { HttpsError } from "firebase-functions/v2/https";
import type { SurveyModuleRole } from "../contracts";
import { db } from "./firebase";

export async function assertModuleEnabled(orgId: string): Promise<void> {
  const entitlement = await db.doc(`organizations/${orgId}/moduleEntitlements/surveys`).get();
  if (!entitlement.exists || entitlement.get("enabled") !== true) {
    throw new HttpsError("failed-precondition", "The survey module is disabled.");
  }
}

export async function assertRole(
  orgId: string,
  uid: string | undefined,
  allowedRoles: readonly SurveyModuleRole[],
): Promise<void> {
  if (!uid) throw new HttpsError("unauthenticated", "Sign-in is required.");
  const membership = await db.doc(`organizations/${orgId}/members/${uid}`).get();
  if (!membership.exists) throw new HttpsError("permission-denied", "Membership is required.");
  const roles = membership.get("roles");
  if (!Array.isArray(roles) || !allowedRoles.some((role) => roles.includes(role))) {
    throw new HttpsError("permission-denied", "Your role does not allow this operation.");
  }
}
