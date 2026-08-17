import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { defineBoolean } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import {
  ClaimInvitationInputSchema,
  InviteMemberInputSchema,
  OrganizationIdSchema,
  RemoveMemberInputSchema,
  UpdateMemberRolesInputSchema,
  type MemberSummary,
  type SurveyModuleRole,
} from "./contracts";
import { safeAudit } from "./core/audit";
import { parseInput } from "./core/errors";
import { db } from "./core/firebase";
import { assertModuleEnabled, assertRole } from "./core/permissions";

const enforceAppCheck = defineBoolean("ENFORCE_APP_CHECK", { default: false });

function toMemberSummary(doc: {
  id: string;
  data(): FirebaseFirestore.DocumentData;
}): MemberSummary {
  const data = doc.data();
  return {
    uid: doc.id,
    email: data.email || undefined,
    displayName: data.displayName || undefined,
    roles: Array.isArray(data.roles) ? (data.roles as SurveyModuleRole[]) : [],
    active: data.active !== false,
    createdAt: data.createdAt,
  };
}

/** Lists an organization's members (org_admin). */
export const listMembersV1 = onCall({ enforceAppCheck, cors: true }, async (request) => {
  const requestId = randomUUID();
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign-in is required.");
  const input = parseInput(z.object({ orgId: OrganizationIdSchema }), request.data);
  await assertModuleEnabled(input.orgId);
  await assertRole(input.orgId, uid, ["org_admin"], request.auth?.token?.email);

  const snapshot = await db
    .collection(`organizations/${input.orgId}/members`)
    .orderBy("createdAt", "asc")
    .limit(200)
    .get();
  const members = snapshot.docs.map(toMemberSummary);

  return { ok: true as const, requestId, members };
});

/** Invites a user by email with the given roles (org_admin). */
export const inviteMemberV1 = onCall({ enforceAppCheck, cors: true }, async (request) => {
  const requestId = randomUUID();
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign-in is required.");
  const input = parseInput(InviteMemberInputSchema, request.data);
  await assertModuleEnabled(input.orgId);
  await assertRole(input.orgId, uid, ["org_admin"], request.auth?.token?.email);

  const invitationId = input.email.toLowerCase();
  const invitationRef = db.doc(`organizations/${input.orgId}/invitations/${invitationId}`);
  const existing = await invitationRef.get();
  if (existing.exists) {
    throw new HttpsError("already-exists", "That email already has a pending invitation.");
  }
  await invitationRef.set({
    email: input.email.toLowerCase(),
    roles: input.roles,
    invitedBy: uid,
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
  });

  await safeAudit({
    orgId: input.orgId,
    actorUid: uid,
    action: "members.invited",
    resourceType: "organization",
    resourceId: input.orgId,
    requestId,
    details: { email: input.email.toLowerCase(), roles: input.roles },
  });

  return { ok: true as const, requestId, invitationId };
});

/** Updates a member's roles (org_admin). Cannot demote the last org_admin. */
export const updateMemberRolesV1 = onCall({ enforceAppCheck, cors: true }, async (request) => {
  const requestId = randomUUID();
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign-in is required.");
  const input = parseInput(UpdateMemberRolesInputSchema, request.data);
  await assertModuleEnabled(input.orgId);
  await assertRole(input.orgId, uid, ["org_admin"], request.auth?.token?.email);

  const memberRef = db.doc(`organizations/${input.orgId}/members/${input.uid}`);
  const member = await memberRef.get();
  if (!member.exists) throw new HttpsError("not-found", "Member not found.");

  const wasOrgAdmin =
    Array.isArray(member.get("roles")) && (member.get("roles") as string[]).includes("org_admin");
  const isOrgAdmin = input.roles.includes("org_admin");
  if (wasOrgAdmin && !isOrgAdmin && input.uid === uid) {
    throw new HttpsError("failed-precondition", "You cannot remove your own org_admin role.");
  }

  await memberRef.update({ roles: input.roles, updatedAt: FieldValue.serverTimestamp() });
  await safeAudit({
    orgId: input.orgId,
    actorUid: uid,
    action: "members.roles_updated",
    resourceType: "organization",
    resourceId: input.orgId,
    requestId,
    details: { targetUid: input.uid, roles: input.roles },
  });

  return { ok: true as const, requestId };
});

/** Removes a member (org_admin). Cannot remove yourself. */
export const removeMemberV1 = onCall({ enforceAppCheck, cors: true }, async (request) => {
  const requestId = randomUUID();
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign-in is required.");
  const input = parseInput(RemoveMemberInputSchema, request.data);
  await assertModuleEnabled(input.orgId);
  await assertRole(input.orgId, uid, ["org_admin"], request.auth?.token?.email);
  if (input.uid === uid) {
    throw new HttpsError("failed-precondition", "You cannot remove your own membership.");
  }

  await db.doc(`organizations/${input.orgId}/members/${input.uid}`).delete();
  await safeAudit({
    orgId: input.orgId,
    actorUid: uid,
    action: "members.removed",
    resourceType: "organization",
    resourceId: input.orgId,
    requestId,
    details: { targetUid: input.uid },
  });

  return { ok: true as const, requestId };
});

/**
 * Claims a pending invitation for the signed-in user. The invitation is keyed
 * by email, and the server verifies the invitation email matches the verified
 * token email before creating the membership (keyed by uid).
 */
export const claimInvitationV1 = onCall({ enforceAppCheck, cors: true }, async (request) => {
  const requestId = randomUUID();
  const uid = request.auth?.uid;
  const email = request.auth?.token?.email;
  if (!uid || !email) throw new HttpsError("unauthenticated", "Sign-in is required.");
  const input = parseInput(ClaimInvitationInputSchema, request.data);
  const invitationId = input.invitationId.toLowerCase();

  const invitationRef = db.doc(`organizations/${input.orgId}/invitations/${invitationId}`);
  const invitation = await invitationRef.get();
  if (!invitation.exists) throw new HttpsError("not-found", "No pending invitation found.");
  if ((invitation.get("email") as string | undefined)?.toLowerCase() !== email.toLowerCase()) {
    throw new HttpsError("permission-denied", "This invitation is not for your account.");
  }

  const memberRef = db.doc(`organizations/${input.orgId}/members/${uid}`);
  const member = await memberRef.get();
  if (member.exists) {
    await invitationRef.delete();
    return { ok: true as const, requestId, alreadyMember: true as const };
  }

  await memberRef.set({
    uid,
    email: email.toLowerCase(),
    displayName: request.auth?.token?.name ?? null,
    roles: invitation.get("roles") as SurveyModuleRole[],
    active: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await invitationRef.delete();
  await safeAudit({
    orgId: input.orgId,
    actorUid: uid,
    action: "members.invitation_claimed",
    resourceType: "organization",
    resourceId: input.orgId,
    requestId,
    details: { email: email.toLowerCase() },
  });

  return { ok: true as const, requestId, alreadyMember: false as const };
});
