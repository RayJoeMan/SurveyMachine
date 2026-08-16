import { createHash } from "node:crypto";
import { HttpsError } from "firebase-functions/v2/https";
import { Model } from "survey-core";
import {
  MAX_RESPONSE_BYTES,
  MAX_SURVEY_SCHEMA_BYTES,
  PublicSurveySchema,
  type PublicSurvey,
  type SurveyJsJson,
} from "../contracts";
import { assertJsonSize } from "../core/errors";
import { db } from "../core/firebase";
import { assertModuleEnabled } from "../core/permissions";

const MAX_PAGES = 50;
const MAX_QUESTIONS = 500;

export function validateSurveyDefinition(schema: SurveyJsJson): void {
  assertJsonSize(schema, MAX_SURVEY_SCHEMA_BYTES, "Survey schema");
  let model: Model;
  try {
    model = new Model(schema);
  } catch {
    throw new HttpsError("invalid-argument", "SurveyJS could not load the survey schema.");
  }

  const names = model.getAllQuestions().map((question) => question.name);
  if (names.some((name) => !name || name.length > 160)) {
    throw new HttpsError(
      "invalid-argument",
      "Every question requires a stable name under 160 characters.",
    );
  }
  if (new Set(names).size !== names.length) {
    throw new HttpsError("invalid-argument", "Question names must be unique.");
  }
  if (model.getAllQuestions().length > MAX_QUESTIONS) {
    throw new HttpsError("invalid-argument", `Surveys are limited to ${MAX_QUESTIONS} questions.`);
  }
  if (model.pages.length > MAX_PAGES) {
    throw new HttpsError("invalid-argument", `Surveys are limited to ${MAX_PAGES} pages.`);
  }
  const fileQuestions = model.getAllQuestions().filter((question) => question.getType() === "file");
  if (fileQuestions.length > 0) {
    throw new HttpsError(
      "invalid-argument",
      "File questions cannot be used while file uploads are disabled.",
      { questionNames: fileQuestions.map((question) => question.name) },
    );
  }
}

export function sanitizeSurveyAnswers(
  schema: SurveyJsJson,
  answers: Record<string, unknown>,
  requireComplete: boolean,
): Record<string, unknown> {
  assertJsonSize(answers, MAX_RESPONSE_BYTES, "Survey response");
  const model = new Model(schema);
  model.data = answers;
  model.clearIncorrectValues(true);

  if (requireComplete) {
    const missingRequired = model
      .getAllQuestions()
      .filter((question) => question.isVisible && question.isRequired && question.isEmpty())
      .map((question) => question.name);
    if (missingRequired.length > 0) {
      throw new HttpsError("invalid-argument", "Required survey answers are missing.", {
        fields: missingRequired,
      });
    }
  }

  return model.data as Record<string, unknown>;
}

export function responseDocumentId(publicSurveyId: string, clientSubmissionId: string): string {
  return createHash("sha256").update(`${publicSurveyId}:${clientSubmissionId}`).digest("hex");
}

export function safeDurationMs(startedAt: string): number {
  const duration = Date.now() - new Date(startedAt).getTime();
  const maximum = 30 * 24 * 60 * 60 * 1_000;
  return Number.isFinite(duration) ? Math.min(Math.max(duration, 0), maximum) : 0;
}

export async function loadOpenPublicSurvey(publicSurveyId: string): Promise<PublicSurvey> {
  const snapshot = await db.doc(`publicSurveys/${publicSurveyId}`).get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Survey not found.");
  const parsed = PublicSurveySchema.safeParse(snapshot.data());
  if (!parsed.success) {
    throw new HttpsError("internal", "Published survey configuration is invalid.");
  }
  const survey = parsed.data;
  await assertModuleEnabled(survey.orgId);
  if (survey.status !== "published") {
    throw new HttpsError("failed-precondition", "This survey is closed.");
  }
  if (survey.settings.closesAt && Date.now() >= new Date(survey.settings.closesAt).getTime()) {
    throw new HttpsError("failed-precondition", "This survey has reached its closing date.");
  }
  return survey;
}
