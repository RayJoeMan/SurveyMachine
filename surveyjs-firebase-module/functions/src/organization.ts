import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { defineBoolean, defineInt } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  CreateOrganizationInputSchema,
  ExportOrganizationDataInputSchema,
  isReservedOrgId,
  slugifyOrganizationName,
} from "./contracts";
import { safeAudit } from "./core/audit";
import { parseInput } from "./core/errors";
import { db, getDefaultBucket } from "./core/firebase";
import { assertRole } from "./core/permissions";

const enforceAppCheck = defineBoolean("ENFORCE_APP_CHECK", { default: false });
const exportUrlTtlMinutes = defineInt("EXPORT_URL_TTL_MINUTES", { default: 15 });

const CREATOR_ROLES = ["org_admin", "survey_admin", "survey_editor", "report_viewer"] as const;

/**
 * Self-service organization creation for an authenticated user. Creates the
 * organization document, its survey-module entitlement, and the creator's
 * membership (org_admin and all survey roles). Identity fields are read from
 * the verified ID token, never from client input. Membership/roles remain
 * non-client-writable; this trusted callable is the only creation path.
 */
export const createOrganizationV1 = onCall({ enforceAppCheck, cors: true }, async (request) => {
  const requestId = randomUUID();
  const identity = request.auth;
  const uid = identity?.uid;
  if (!identity || !uid) throw new HttpsError("unauthenticated", "Sign-in is required.");
  const input = parseInput(CreateOrganizationInputSchema, request.data);
  const orgId = input.orgId || slugifyOrganizationName(input.name);
  if (isReservedOrgId(orgId)) {
    throw new HttpsError("invalid-argument", "That organization identifier is reserved.");
  }

  const orgRef = db.doc(`organizations/${orgId}`);
  const created = await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(orgRef);
    if (existing.exists) {
      const member = await transaction.get(orgRef.collection("members").doc(uid));
      if (member.exists) return false;
      throw new HttpsError("already-exists", "That organization identifier is already taken.");
    }
    const now = FieldValue.serverTimestamp();
    transaction.set(orgRef, { orgId, name: input.name, createdAt: now, updatedAt: now });
    transaction.set(orgRef.collection("moduleEntitlements").doc("surveys"), {
      moduleId: "surveys",
      enabled: true,
      scope: "organization",
      updatedBy: uid,
      updatedAt: now,
    });
    transaction.set(orgRef.collection("members").doc(uid), {
      uid,
      email: identity.token?.email ?? null,
      displayName: identity.token?.name ?? null,
      roles: CREATOR_ROLES,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    return true;
  });

  await safeAudit({
    orgId,
    actorUid: uid,
    action: created ? "organization.created" : "organization.membership_acknowledged",
    resourceType: "organization",
    resourceId: orgId,
    requestId,
  });
  return { ok: true as const, requestId, orgId, created };
});

/** Deterministic storage path prefix for organization data exports. */
export function orgExportStoragePath(orgId: string, fileName: string): string {
  return `survey-exports/${orgId}/org-data/${fileName}`;
}

/**
 * Org-level data export for administrators. Exports organization identity,
 * entitlement, members, and survey definitions (the organization's own
 * content). Raw responses are intentionally NOT included here — they are
 * exported per survey via createSurveyExportV1 so response exports remain
 * survey-scoped and role-gated identically.
 */
export const exportOrganizationDataV1 = onCall(
  { enforceAppCheck, cors: true, timeoutSeconds: 120, memory: "512MiB" },
  async (request) => {
    const requestId = randomUUID();
    const input = parseInput(ExportOrganizationDataInputSchema, request.data);
    await assertRole(input.orgId, request.auth?.uid, ["org_admin"], request.auth?.token?.email);

    const orgRef = db.doc(`organizations/${input.orgId}`);
    const [org, entitlement, members, surveys] = await Promise.all([
      orgRef.get(),
      orgRef.collection("moduleEntitlements").doc("surveys").get(),
      orgRef.collection("members").get(),
      orgRef.collection("surveys").get(),
    ]);

    const data = {
      exportedAt: new Date().toISOString(),
      exportedBy: request.auth?.uid ?? null,
      org: org.exists ? org.data() : null,
      moduleEntitlements: {
        surveys: entitlement.exists ? entitlement.data() : null,
      },
      members: members.docs.map((document) => {
        const member = document.data();
        return {
          uid: document.id,
          email: member.email ?? null,
          displayName: member.displayName ?? null,
          roles: member.roles ?? [],
          active: member.active ?? true,
        };
      }),
      surveys: surveys.docs.map((document) => {
        const survey = document.data();
        return {
          surveyId: document.id,
          title: survey.title,
          description: survey.description,
          status: survey.status,
          publishedVersion: survey.publishedVersion,
          settings: survey.settings,
          branding: survey.branding,
          schema: survey.schema,
          hasUnpublishedChanges: survey.hasUnpublishedChanges,
          updatedAt: survey.updatedAt,
        };
      }),
      note: "Raw responses are exported per survey via the report page CSV export.",
    };

    const fileName = `${Date.now()}-${requestId}.json`;
    const filePath = orgExportStoragePath(input.orgId, fileName);
    const bucket = getDefaultBucket();
    const file = bucket.file(filePath);
    await file.save(JSON.stringify(data, null, 2), {
      contentType: "application/json; charset=utf-8",
      metadata: { cacheControl: "private, no-store, max-age=0" },
      resumable: false,
    });

    const expiresAtMs = Date.now() + exportUrlTtlMinutes.value() * 60_000;
    const [downloadUrl] = await file.getSignedUrl({ action: "read", expires: expiresAtMs });

    await safeAudit({
      orgId: input.orgId,
      actorUid: request.auth!.uid,
      action: "organization.data_exported",
      resourceType: "organization",
      resourceId: input.orgId,
      requestId,
      details: { fileName },
    });

    return {
      ok: true as const,
      requestId,
      downloadUrl,
      expiresAt: new Date(expiresAtMs).toISOString(),
      surveyCount: surveys.size,
      memberCount: members.size,
    };
  },
);
