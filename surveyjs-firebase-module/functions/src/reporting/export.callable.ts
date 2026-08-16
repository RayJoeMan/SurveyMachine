import { randomUUID } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { defineBoolean, defineInt } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { ExportSurveyInputSchema } from "../contracts";
import { safeAudit } from "../core/audit";
import { parseInput } from "../core/errors";
import { db, getDefaultBucket } from "../core/firebase";
import { assertRole } from "../core/permissions";
import { responsesToCsv } from "./csv";

const enforceAppCheck = defineBoolean("ENFORCE_APP_CHECK", { default: false });
const exportUrlTtlMinutes = defineInt("EXPORT_URL_TTL_MINUTES", { default: 15 });
const exportLimit = 5_000;

export const createSurveyExportV1 = onCall(
  { enforceAppCheck, cors: true, timeoutSeconds: 120, memory: "512MiB" },
  async (request) => {
    const requestId = randomUUID();
    const input = parseInput(ExportSurveyInputSchema, request.data);
    await assertRole(input.orgId, request.auth?.uid, [
      "org_admin",
      "survey_admin",
      "report_viewer",
    ]);

    const surveyRef = db.doc(`organizations/${input.orgId}/surveys/${input.surveyId}`);
    const survey = await surveyRef.get();
    if (!survey.exists) throw new HttpsError("not-found", "Survey not found.");

    const jobId = randomUUID();
    const jobRef = surveyRef.collection("exportJobs").doc(jobId);
    await jobRef.set({
      jobId,
      requestedBy: request.auth!.uid,
      format: input.format,
      status: "processing",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    try {
      const snapshot = await surveyRef
        .collection("responses")
        .where("status", "==", "completed")
        .orderBy("submittedAt", "desc")
        .limit(exportLimit)
        .get();
      const responses = snapshot.docs.map(
        (item) => item.data() as Parameters<typeof responsesToCsv>[0][number],
      );
      const csv = responsesToCsv(responses);
      const filePath = `survey-exports/${input.orgId}/${input.surveyId}/${Date.now()}-${jobId}.csv`;
      const bucket = getDefaultBucket();
      const file = bucket.file(filePath);
      await file.save(Buffer.from(csv, "utf8"), {
        contentType: "text/csv; charset=utf-8",
        metadata: { cacheControl: "private, no-store, max-age=0" },
        resumable: false,
      });

      const expiresAtMs = Date.now() + exportUrlTtlMinutes.value() * 60_000;
      const [downloadUrl] = await file.getSignedUrl({ action: "read", expires: expiresAtMs });
      await jobRef.update({
        status: "ready",
        responseCount: responses.length,
        filePath,
        expiresAt: Timestamp.fromMillis(expiresAtMs),
        updatedAt: FieldValue.serverTimestamp(),
      });

      await safeAudit({
        orgId: input.orgId,
        actorUid: request.auth!.uid,
        action: "survey.responses_exported",
        resourceType: "survey",
        resourceId: input.surveyId,
        requestId,
        details: { jobId, responseCount: responses.length, format: input.format },
      });
      return {
        ok: true as const,
        requestId,
        jobId,
        downloadUrl,
        expiresAt: new Date(expiresAtMs).toISOString(),
        responseCount: responses.length,
      };
    } catch (error) {
      await jobRef.update({
        status: "failed",
        failureCode: "export_generation_failed",
        updatedAt: FieldValue.serverTimestamp(),
      });
      throw error;
    }
  },
);
