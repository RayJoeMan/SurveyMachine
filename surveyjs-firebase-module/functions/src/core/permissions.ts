import { HttpsError } from "firebase-functions/v2/https";
import { isSuperAdminEmail, type SurveyModuleRole } from "../contracts";
import { db } from "./firebase";

export async function assertModuleEnabled(orgId: string): Promise<void> {
  const entitlement = await db.doc(`organizations/${orgId}/moduleEntitlements/surveys`).get();
  if (!entitlement.exists || entitlement.get("enabled") !== true) {
    throw new HttpsError("failed-precondition", "The survey module is disabled.");
  }
}

/**
 * Asserts the caller may perform a role-gated operation inside an organization.
 * Super-admin accounts (verified token email in SUPER_ADMIN_EMAILS) bypass the
 * membership/role check so they can operate across every organization without
 * needing a membership document.
 */
export async function assertRole(
  orgId: string,
  uid: string | undefined,
  allowedRoles: readonly SurveyModuleRole[],
  email?: string | undefined,
): Promise<void> {
  if (!uid) throw new HttpsError("unauthenticated", "Sign-in is required.");
  if (isSuperAdminEmail(email)) return;
  const membership = await db.doc(`organizations/${orgId}/members/${uid}`).get();
  if (!membership.exists) throw new HttpsError("permission-denied", "Membership is required.");
  const roles = membership.get("roles");
  if (!Array.isArray(roles) || !allowedRoles.some((role) => roles.includes(role))) {
    throw new HttpsError("permission-denied", "Your role does not allow this operation.");
  }
}
