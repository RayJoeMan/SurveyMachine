import { randomBytes, randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { defineBoolean } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { SurveyActionInputSchema, UpsertSurveyInputSchema } from "../contracts";
import { safeAudit } from "../core/audit";
import { parseInput } from "../core/errors";
import { db } from "../core/firebase";
import { assertModuleEnabled, assertRole } from "../core/permissions";
import { validateSurveyDefinition } from "./domain";

const enforceAppCheck = defineBoolean("ENFORCE_APP_CHECK", { default: false });

function createSurveyId(title: string): string {
  const base =
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "survey";
  return `${base}-${randomBytes(3).toString("hex")}`;
}

export const upsertSurveyV1 = onCall({ enforceAppCheck, cors: true }, async (request) => {
  const requestId = randomUUID();
  const input = parseInput(UpsertSurveyInputSchema, request.data);
  await Promise.all([
    assertModuleEnabled(input.orgId),
    assertRole(
      input.orgId,
      request.auth?.uid,
      ["org_admin", "survey_admin", "survey_editor"],
      request.auth?.token?.email,
    ),
  ]);
  validateSurveyDefinition(input.schema);

  const surveyId = input.surveyId || createSurveyId(input.title);
  const surveyRef = db.doc(`organizations/${input.orgId}/surveys/${surveyId}`);
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(surveyRef);
    const currentRevision = Number(existing.exists ? existing.get("draftRevision") || 0 : 0);
    if (
      input.expectedDraftRevision !== undefined &&
      input.expectedDraftRevision !== currentRevision
    ) {
      throw new HttpsError(
        "aborted",
        "This draft was changed by someone else. Reload the survey before saving again.",
        { currentDraftRevision: currentRevision },
      );
    }
    const draftRevision = currentRevision + 1;
    transaction.set(
      surveyRef,
      {
        surveyId,
        orgId: input.orgId,
        title: input.title,
        description: input.description,
        schema: input.schema,
        settings: input.settings,
        branding: input.branding,
        status: existing.exists ? existing.get("status") : "draft",
        publishedVersion: Number(existing.get("publishedVersion") || 0),
        draftRevision,
        hasUnpublishedChanges: true,
        createdBy: existing.exists ? existing.get("createdBy") : request.auth!.uid,
        createdAt: existing.exists ? existing.get("createdAt") : FieldValue.serverTimestamp(),
        updatedBy: request.auth!.uid,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  await safeAudit({
    orgId: input.orgId,
    actorUid: request.auth!.uid,
    action: "survey.draft_saved",
    resourceType: "survey",
    resourceId: surveyId,
    requestId,
  });
  return { ok: true as const, requestId, surveyId };
});

export const publishSurveyV1 = onCall({ enforceAppCheck, cors: true }, async (request) => {
  const requestId = randomUUID();
  const input = parseInput(SurveyActionInputSchema, request.data);
  await Promise.all([
    assertModuleEnabled(input.orgId),
    assertRole(
      input.orgId,
      request.auth?.uid,
      ["org_admin", "survey_admin"],
      request.auth?.token?.email,
    ),
  ]);
  const surveyRef = db.doc(`organizations/${input.orgId}/surveys/${input.surveyId}`);
  const publicRef = db.doc(`publicSurveys/${input.surveyId}`);
  let publishedVersion = 0;

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(surveyRef);
    if (!snapshot.exists) throw new HttpsError("not-found", "Survey not found.");
    const survey = snapshot.data();
    if (!survey) throw new HttpsError("internal", "Survey data is unavailable.");
    validateSurveyDefinition(survey.schema);
    publishedVersion = Number(survey.publishedVersion || 0) + 1;
    const versionRef = surveyRef.collection("versions").doc(String(publishedVersion));
    const projection = {
      publicSurveyId: input.surveyId,
      orgId: input.orgId,
      surveyId: input.surveyId,
      version: publishedVersion,
      status: "published",
      title: survey.title,
      description: survey.description,
      schema: survey.schema,
      settings: survey.settings,
      branding: survey.branding,
      publishedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    transaction.set(versionRef, {
      ...projection,
      publishedBy: request.auth!.uid,
    });
    transaction.set(publicRef, projection);
    transaction.update(surveyRef, {
      status: "published",
      publishedVersion,
      hasUnpublishedChanges: false,
      publishedBy: request.auth!.uid,
      publishedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await safeAudit({
    orgId: input.orgId,
    actorUid: request.auth!.uid,
    action: "survey.published",
    resourceType: "survey",
    resourceId: input.surveyId,
    requestId,
    details: { version: publishedVersion },
  });
  return {
    ok: true as const,
    requestId,
    publicSurveyId: input.surveyId,
    version: publishedVersion,
  };
});

export const closeSurveyV1 = onCall({ enforceAppCheck, cors: true }, async (request) => {
  const requestId = randomUUID();
  const input = parseInput(SurveyActionInputSchema, request.data);
  await assertRole(
    input.orgId,
    request.auth?.uid,
    ["org_admin", "survey_admin"],
    request.auth?.token?.email,
  );
  const surveyRef = db.doc(`organizations/${input.orgId}/surveys/${input.surveyId}`);
  const publicRef = db.doc(`publicSurveys/${input.surveyId}`);

  await db.runTransaction(async (transaction) => {
    const [survey, publicSurvey] = await Promise.all([
      transaction.get(surveyRef),
      transaction.get(publicRef),
    ]);
    if (!survey.exists) throw new HttpsError("not-found", "Survey not found.");
    transaction.update(surveyRef, {
      status: "closed",
      closedBy: request.auth!.uid,
      closedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (publicSurvey.exists) {
      transaction.update(publicRef, {
        status: "closed",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });

  await safeAudit({
    orgId: input.orgId,
    actorUid: request.auth!.uid,
    action: "survey.closed",
    resourceType: "survey",
    resourceId: input.surveyId,
    requestId,
  });
  return { ok: true as const, requestId };
});

const SURVEY_SUBCOLLECTIONS = [
  "versions",
  "responses",
  "aggregates",
  "counters",
  "eventReceipts",
  "exportJobs",
  "outbox",
] as const;

/**
 * Server-side, admin-only survey deletion. Deletes the private definition, every
 * subcollection (including responses), and the public projection — in bounded
 * batches — and records an audit entry. Client-initiated deletes remain denied
 * by Firestore rules; this callable is the only deletion path.
 */
export const deleteSurveyV1 = onCall(
  { enforceAppCheck, cors: true, timeoutSeconds: 120, memory: "512MiB" },
  async (request) => {
    const requestId = randomUUID();
    const input = parseInput(SurveyActionInputSchema, request.data);
    await assertRole(
      input.orgId,
      request.auth?.uid,
      ["org_admin", "survey_admin"],
      request.auth?.token?.email,
    );

    const surveyRef = db.doc(`organizations/${input.orgId}/surveys/${input.surveyId}`);
    const survey = await surveyRef.get();
    if (!survey.exists) {
      return { ok: true as const, requestId, deleted: false };
    }

    for (const subcollection of SURVEY_SUBCOLLECTIONS) {
      const collectionRef = surveyRef.collection(subcollection);
      for (;;) {
        const snapshot = await collectionRef.limit(500).get();
        if (snapshot.empty) break;
        const batch = db.batch();
        snapshot.docs.forEach((document) => batch.delete(document.ref));
        await batch.commit();
      }
    }

    await surveyRef.delete();

    // Remove the public projection only if it belongs to this organization.
    const publicRef = db.doc(`publicSurveys/${input.surveyId}`);
    const publicSurvey = await publicRef.get();
    if (publicSurvey.exists && publicSurvey.get("orgId") === input.orgId) {
      await publicRef.delete();
    }

    await safeAudit({
      orgId: input.orgId,
      actorUid: request.auth!.uid,
      action: "survey.deleted",
      resourceType: "survey",
      resourceId: input.surveyId,
      requestId,
    });
    return { ok: true as const, requestId, deleted: true };
  },
);
