import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { defineBoolean } from "firebase-functions/params";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { SurveyActionInputSchema, type SurveyJsJson } from "../contracts";
import { safeAudit } from "../core/audit";
import { parseInput } from "../core/errors";
import { db } from "../core/firebase";
import { assertModuleEnabled, assertRole } from "../core/permissions";
import { enforceRateLimit, rateLimitKey } from "../core/rateLimit";
import { questionCounts } from "./aggregates";

const enforceAppCheck = defineBoolean("ENFORCE_APP_CHECK", { default: false });

const RECOMPUTE_RATE_LIMIT = { limit: 5, windowMs: 60 * 60_000 };
const RESPONSE_BATCH = 500;
const RESPONSE_CAP = 50_000;

function callerIdentity(request: CallableRequest): string {
  const remoteAddress =
    request.rawRequest?.ip ?? request.rawRequest?.socket?.remoteAddress ?? "unknown";
  return `${remoteAddress}|${request.auth?.uid ?? "anon"}`;
}

/**
 * Internal aggregation handler: rebuilds the summary and per-question
 * distributions for a survey from scratch by scanning completed/in-progress
 * responses. Used for backfill and to repair aggregates if deltas ever drift.
 * Org_admin only and rate-limited.
 */
export const recomputeSurveyAggregatesV1 = onCall(
  { enforceAppCheck, cors: true, timeoutSeconds: 300, memory: "512MiB" },
  async (request) => {
    const requestId = randomUUID();
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign-in is required.");
    const input = parseInput(SurveyActionInputSchema, request.data);
    await assertModuleEnabled(input.orgId);
    await assertRole(input.orgId, uid, ["org_admin"], request.auth?.token?.email);
    await enforceRateLimit({
      ...RECOMPUTE_RATE_LIMIT,
      key: rateLimitKey(`recompute:${input.orgId}:${input.surveyId}`, callerIdentity(request)),
      label: "Aggregate recompute",
    });

    const surveyRef = db.doc(`organizations/${input.orgId}/surveys/${input.surveyId}`);
    const survey = await surveyRef.get();
    if (!survey.exists) throw new HttpsError("not-found", "Survey not found.");
    const schema = survey.data()?.schema as SurveyJsJson | undefined;
    if (!schema) throw new HttpsError("failed-precondition", "Survey has no schema.");

    const responsesRef = surveyRef.collection("responses");
    const aggregatesRef = surveyRef.collection("aggregates");

    let completed = 0;
    let inProgress = 0;
    let totalDurationMs = 0;
    let lastResponseAt: unknown = null;
    const questions: Record<
      string,
      { questionType: string; counts: Record<string, number>; total: number }
    > = {};
    let offset = 0;
    let scanned = 0;

    while (offset < RESPONSE_CAP) {
      const batch = await responsesRef
        .orderBy("submittedAt")
        .offset(offset)
        .limit(RESPONSE_BATCH)
        .get();
      if (batch.size === 0) break;
      for (const doc of batch.docs) {
        const data = doc.data();
        const status = data.status;
        const submittedAt = data.submittedAt;
        if (status === "completed") {
          completed += 1;
          const duration = Number(data.durationMs || 0);
          if (Number.isFinite(duration)) totalDurationMs += duration;
          if (submittedAt && (!lastResponseAt || submittedAt > lastResponseAt)) {
            lastResponseAt = submittedAt;
          }
          const counts = questionCounts(schema, data.answers);
          for (const [name, entry] of Object.entries(counts)) {
            const aggregate = (questions[name] ||= {
              questionType: entry.questionType,
              counts: {},
              total: 0,
            });
            aggregate.total += entry.total;
            for (const [key, count] of Object.entries(entry.counts)) {
              aggregate.counts[key] = (aggregate.counts[key] || 0) + count;
            }
          }
        } else if (status === "in_progress") {
          inProgress += 1;
        }
      }
      scanned += batch.size;
      offset += batch.size;
      if (batch.size < RESPONSE_BATCH) break;
    }

    await db.runTransaction(async (transaction) => {
      transaction.set(aggregatesRef.doc("summary"), {
        completed,
        inProgress,
        totalDurationMs,
        lastResponseAt: lastResponseAt ?? null,
        updatedAt: FieldValue.serverTimestamp(),
        recomputedAt: FieldValue.serverTimestamp(),
      });
      transaction.set(aggregatesRef.doc("questions"), {
        ...questions,
        updatedAt: FieldValue.serverTimestamp(),
        recomputedAt: FieldValue.serverTimestamp(),
      });
    });

    await safeAudit({
      orgId: input.orgId,
      actorUid: uid,
      action: "reporting.aggregates_recomputed",
      resourceType: "survey",
      resourceId: input.surveyId,
      requestId,
      details: { scanned, completed, inProgress },
    });

    return {
      ok: true as const,
      requestId,
      scanned,
      completed,
      inProgress,
      totalDurationMs,
    };
  },
);
