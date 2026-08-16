import { createHash } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { db } from "../core/firebase";

function receiptId(eventId: string): string {
  return createHash("sha256").update(eventId).digest("hex");
}

export const updateSurveySummaryV1 = onDocumentWritten(
  "organizations/{orgId}/surveys/{surveyId}/responses/{responseId}",
  async (event) => {
    const before = event.data?.before.exists ? event.data.before.data() : null;
    const after = event.data?.after.exists ? event.data.after.data() : null;
    const wasCompleted = before?.status === "completed";
    const isCompleted = after?.status === "completed";
    const wasInProgress = before?.status === "in_progress";
    const isInProgress = after?.status === "in_progress";
    const completedDelta = Number(isCompleted) - Number(wasCompleted);
    const inProgressDelta = Number(isInProgress) - Number(wasInProgress);
    const durationDelta =
      (isCompleted ? Number(after?.durationMs || 0) : 0) -
      (wasCompleted ? Number(before?.durationMs || 0) : 0);
    if (completedDelta === 0 && inProgressDelta === 0 && durationDelta === 0) return;

    const { orgId, surveyId } = event.params;
    const surveyRef = db.doc(`organizations/${orgId}/surveys/${surveyId}`);
    const summaryRef = surveyRef.collection("aggregates").doc("summary");
    const processedEventRef = surveyRef.collection("eventReceipts").doc(receiptId(event.id));

    await db.runTransaction(async (transaction) => {
      const processed = await transaction.get(processedEventRef);
      if (processed.exists) return;
      transaction.set(
        summaryRef,
        {
          completed: FieldValue.increment(completedDelta),
          inProgress: FieldValue.increment(inProgressDelta),
          totalDurationMs: FieldValue.increment(durationDelta),
          lastResponseAt: after?.submittedAt || FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      transaction.create(processedEventRef, {
        eventId: event.id,
        processedAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1_000),
      });
    });
  },
);
