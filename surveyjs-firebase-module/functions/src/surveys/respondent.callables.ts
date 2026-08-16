import { randomUUID } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { defineBoolean } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { SaveProgressInputSchema, SubmitResponseInputSchema } from "../contracts";
import { parseInput } from "../core/errors";
import { db } from "../core/firebase";
import {
  loadOpenPublicSurvey,
  responseDocumentId,
  safeDurationMs,
  sanitizeSurveyAnswers,
} from "./domain";

const enforceAppCheck = defineBoolean("ENFORCE_APP_CHECK", { default: false });

function assertRespondentAccess(requireAuthentication: boolean, uid: string | undefined): void {
  if (requireAuthentication && !uid) {
    throw new HttpsError("unauthenticated", "This survey requires sign-in.");
  }
}

export const saveSurveyProgressV1 = onCall({ enforceAppCheck, cors: true }, async (request) => {
  const requestId = randomUUID();
  const input = parseInput(SaveProgressInputSchema, request.data);
  const survey = await loadOpenPublicSurvey(input.publicSurveyId);
  assertRespondentAccess(survey.settings.requireAuthentication, request.auth?.uid);
  if (!survey.settings.saveProgress) {
    throw new HttpsError("failed-precondition", "Remote progress saving is disabled.");
  }
  const answers = sanitizeSurveyAnswers(survey.schema, input.answers, false);
  const responseId = responseDocumentId(input.publicSurveyId, input.clientSubmissionId);
  const responseRef = db.doc(
    `organizations/${survey.orgId}/surveys/${survey.surveyId}/responses/${responseId}`,
  );

  let completed = false;
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(responseRef);
    if (existing.get("status") === "completed") {
      completed = true;
      return;
    }
    transaction.set(
      responseRef,
      {
        responseId,
        orgId: survey.orgId,
        surveyId: survey.surveyId,
        publicSurveyId: survey.publicSurveyId,
        surveyVersion: survey.version,
        status: "in_progress",
        answers,
        respondentUid: request.auth?.uid || null,
        anonymous: !request.auth?.uid,
        metadata: input.metadata,
        clientStartedAt: Timestamp.fromDate(new Date(input.startedAt)),
        createdAt: existing.exists ? existing.get("createdAt") : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  return { ok: true as const, requestId, responseId, completed };
});

export const submitSurveyResponseV1 = onCall({ enforceAppCheck, cors: true }, async (request) => {
  const requestId = randomUUID();
  const input = parseInput(SubmitResponseInputSchema, request.data);
  const survey = await loadOpenPublicSurvey(input.publicSurveyId);
  assertRespondentAccess(survey.settings.requireAuthentication, request.auth?.uid);
  const answers = sanitizeSurveyAnswers(survey.schema, input.answers, true);
  const responseId = responseDocumentId(input.publicSurveyId, input.clientSubmissionId);
  const responseRef = db.doc(
    `organizations/${survey.orgId}/surveys/${survey.surveyId}/responses/${responseId}`,
  );
  const counterRef = db.doc(
    `organizations/${survey.orgId}/surveys/${survey.surveyId}/counters/submissions`,
  );

  let duplicate = false;
  await db.runTransaction(async (transaction) => {
    const [existing, counter] = await Promise.all([
      transaction.get(responseRef),
      transaction.get(counterRef),
    ]);
    if (existing.get("status") === "completed") {
      duplicate = true;
      return;
    }
    const completedCount = Number(counter.get("completed") || 0);
    if (survey.settings.responseLimit && completedCount >= survey.settings.responseLimit) {
      throw new HttpsError("resource-exhausted", "This survey has reached its response limit.");
    }

    transaction.set(
      responseRef,
      {
        responseId,
        orgId: survey.orgId,
        surveyId: survey.surveyId,
        publicSurveyId: survey.publicSurveyId,
        surveyVersion: survey.version,
        status: "completed",
        answers,
        respondentUid: request.auth?.uid || null,
        anonymous: !request.auth?.uid,
        metadata: input.metadata,
        durationMs: safeDurationMs(input.startedAt),
        clientStartedAt: Timestamp.fromDate(new Date(input.startedAt)),
        clientCompletedAt: Timestamp.fromDate(new Date(input.completedAt)),
        createdAt: existing.exists ? existing.get("createdAt") : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        submittedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    transaction.set(
      counterRef,
      {
        completed: completedCount + 1,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  return { ok: true as const, requestId, responseId, duplicate };
});
