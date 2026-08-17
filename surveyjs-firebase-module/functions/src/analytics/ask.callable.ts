import { randomUUID } from "node:crypto";
import { defineBoolean } from "firebase-functions/params";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { AskSurveyDataInputSchema, BillingInfoSchema, type SurveyJsJson } from "../contracts";
import { safeAudit } from "../core/audit";
import { parseInput } from "../core/errors";
import { db } from "../core/firebase";
import { assertModuleEnabled, assertRole } from "../core/permissions";
import { enforceRateLimit, rateLimitKey } from "../core/rateLimit";
import { generateText } from "./llm";
import {
  buildContextText,
  buildPrompt,
  extractRecentTextAnswers,
  SYSTEM_PROMPT,
  type AggregatesShape,
} from "./prompt";

const enforceAppCheck = defineBoolean("ENFORCE_APP_CHECK", { default: false });

const ASK_RATE_LIMIT = { limit: 30, windowMs: 60 * 60_000 };

function callerIdentity(request: CallableRequest): string {
  const remoteAddress =
    request.rawRequest?.ip ?? request.rawRequest?.socket?.remoteAddress ?? "unknown";
  return `${remoteAddress}|${request.auth?.uid ?? "anon"}`;
}

/** AI analytics is part of the paid plans (active or trialing subscription). */
async function assertPaidPlan(orgId: string): Promise<void> {
  const snapshot = await db.doc(`organizations/${orgId}/billing/subscription`).get();
  if (!snapshot.exists) {
    throw new HttpsError(
      "permission-denied",
      "AI analytics is a Pro and Enterprise feature. Upgrade to use it.",
    );
  }
  const parsed = BillingInfoSchema.safeParse(snapshot.data());
  const status = parsed.success ? parsed.data.status : "none";
  if (status !== "active" && status !== "trialing") {
    throw new HttpsError(
      "permission-denied",
      "AI analytics is a Pro and Enterprise feature. Upgrade to use it.",
    );
  }
}

/**
 * Answers a natural-language question about a survey's aggregated results.
 * Only completed responses are summarized; the LLM receives aggregates plus a
 * bounded sample of recent free-text answers. Access: report roles + paid plan.
 * The LLM API key is server-side only (LLM_API_KEY).
 */
export const askSurveyDataV1 = onCall(
  { enforceAppCheck, cors: true, timeoutSeconds: 90, memory: "512MiB" },
  async (request) => {
    const requestId = randomUUID();
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign-in is required.");
    const input = parseInput(AskSurveyDataInputSchema, request.data);
    await assertModuleEnabled(input.orgId);
    await assertRole(
      input.orgId,
      uid,
      ["org_admin", "survey_admin", "report_viewer"],
      request.auth?.token?.email,
    );
    await assertPaidPlan(input.orgId);
    await enforceRateLimit({
      ...ASK_RATE_LIMIT,
      key: rateLimitKey(`ask:${input.orgId}:${input.surveyId}`, callerIdentity(request)),
      label: "AI survey questions",
    });

    const [orgSnap, surveySnap, summarySnap, aggregatesSnap, responsesSnap] = await Promise.all([
      db.doc(`organizations/${input.orgId}`).get(),
      db.doc(`organizations/${input.orgId}/surveys/${input.surveyId}`).get(),
      db.doc(`organizations/${input.orgId}/surveys/${input.surveyId}/aggregates/summary`).get(),
      db.doc(`organizations/${input.orgId}/surveys/${input.surveyId}/aggregates/questions`).get(),
      db
        .collection(`organizations/${input.orgId}/surveys/${input.surveyId}/responses`)
        .where("status", "==", "completed")
        .orderBy("submittedAt", "desc")
        .limit(25)
        .get(),
    ]);

    if (!surveySnap.exists) {
      throw new HttpsError("not-found", "Survey not found.");
    }
    const survey = surveySnap.data() as {
      title: string;
      description?: string;
      schema: SurveyJsJson;
    };
    const schema = survey.schema;
    if (!schema) {
      throw new HttpsError("failed-precondition", "The survey has no schema to analyze.");
    }

    const summary = summarySnap.exists
      ? (summarySnap.data() as { completed: number; inProgress: number; totalDurationMs: number })
      : { completed: 0, inProgress: 0, totalDurationMs: 0 };
    const aggregates = aggregatesSnap.exists ? (aggregatesSnap.data() as AggregatesShape) : {};
    const recentTextAnswers = extractRecentTextAnswers(
      schema,
      responsesSnap.docs.map((doc) => doc.data() as { answers?: Record<string, unknown> }),
    );

    const contextText = buildContextText({
      orgName: (orgSnap.get("name") as string | undefined) ?? input.orgId,
      surveyTitle: survey.title,
      surveyDescription: survey.description ?? "",
      summary: {
        completed: summary.completed ?? 0,
        inProgress: summary.inProgress ?? 0,
        totalDurationMs: summary.totalDurationMs ?? 0,
      },
      aggregates,
      recentTextAnswers,
    });

    const result = await generateText(SYSTEM_PROMPT, buildPrompt(input.question, contextText));

    await safeAudit({
      orgId: input.orgId,
      actorUid: uid,
      action: "analytics.asked",
      resourceType: "survey",
      resourceId: input.surveyId,
      requestId,
      details: { question: input.question.slice(0, 200), model: result.model },
    });

    return {
      ok: true as const,
      requestId,
      answer: result.text,
      provider: result.provider,
      model: result.model,
    };
  },
);
