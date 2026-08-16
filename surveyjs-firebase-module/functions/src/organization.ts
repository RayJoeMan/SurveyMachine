import { randomUUID } from "node:crypto";
import { defineBoolean, defineInt } from "firebase-functions/params";
import { onCall } from "firebase-functions/v2/https";
import { ExportOrganizationDataInputSchema } from "./contracts";
import { safeAudit } from "./core/audit";
import { parseInput } from "./core/errors";
import { db, getDefaultBucket } from "./core/firebase";
import { assertRole } from "./core/permissions";

const enforceAppCheck = defineBoolean("ENFORCE_APP_CHECK", { default: false });
const exportUrlTtlMinutes = defineInt("EXPORT_URL_TTL_MINUTES", { default: 15 });

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
    await assertRole(input.orgId, request.auth?.uid, ["org_admin"]);

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
