import { createHmac, randomUUID } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { defineInt, defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { OUTBOX_MAX_ATTEMPTS, type OutboxEvent } from "../contracts";
import { db } from "../core/firebase";

const webhookSigningSecret = defineSecret("WEBHOOK_SIGNING_SECRET");
const outboxBatchSize = defineInt("OUTBOX_BATCH_SIZE", { default: 20 });

/**
 * Exponential backoff for outbox retries: 1m, 2m, 4m … capped at 1h, plus a
 * small jitter so a burst of failures does not re-synchronize.
 */
export function computeNextAttemptAt(attempt: number, nowMs = Date.now(), jitterMs = 0): Date {
  const baseDelay = Math.min(2 ** Math.max(attempt - 1, 0) * 60_000, 60 * 60_000);
  const jitter = jitterMs > 0 ? jitterMs : Math.floor(Math.random() * 5_000);
  return new Date(nowMs + baseDelay + jitter);
}

export function isDead(attempt: number): boolean {
  return attempt >= OUTBOX_MAX_ATTEMPTS;
}

/** Error text is redacted to a short, bounded string; never include payloads. */
export function redactError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 500);
}

function outboxRef(orgId: string, surveyId?: string) {
  if (surveyId) {
    return db.collection(`organizations/${orgId}/surveys/${surveyId}/outbox`);
  }
  return db.collection(`organizations/${orgId}/outbox`);
}

/**
 * Enqueues an outbox event. Prefer calling this inside the same Firestore
 * transaction as the business change so a later delivery failure never rolls
 * back the business record (e.g. a completed response).
 */
export async function enqueueOutboxEvent(input: {
  orgId: string;
  surveyId?: string;
  eventType: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
}): Promise<string> {
  const eventId = randomUUID();
  const event: OutboxEvent = {
    eventId,
    eventType: input.eventType,
    orgId: input.orgId,
    surveyId: input.surveyId,
    idempotencyKey: input.idempotencyKey,
    status: "pending",
    attempts: 0,
    nextAttemptAt: new Date().toISOString(),
    payload: input.payload,
    error: null,
  };
  await outboxRef(input.orgId, input.surveyId)
    .doc(eventId)
    .set({
      ...event,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  return eventId;
}

interface DeliveryResult {
  ok: boolean;
  error?: string;
}

/**
 * Signed webhook delivery. When WEBHOOK_SIGNING_SECRET is unset the handler
 * reports a clear redacted failure so the item surfaces in the admin view
 * instead of silently succeeding.
 */
async function deliverWebhook(event: OutboxEvent, secret: string): Promise<DeliveryResult> {
  const url = typeof event.payload.url === "string" ? event.payload.url : "";
  if (!url) {
    return { ok: false, error: "Webhook payload is missing a url field." };
  }
  const body = JSON.stringify({
    event: { id: event.eventId, type: event.eventType, orgId: event.orgId },
    data: event.payload.data ?? {},
  });
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-survey-module-signature": `sha256=${signature}`,
        "x-survey-module-event": event.eventId,
        "idempotency-key": event.idempotencyKey,
      },
      body,
    });
    if (response.ok) return { ok: true };
    return { ok: false, error: `Webhook returned HTTP ${response.status}.` };
  } catch (error) {
    return { ok: false, error: redactError(error) };
  }
}

/**
 * Scheduled worker that drains pending outbox events with exponential backoff.
 * Items are marked `dead` after OUTBOX_MAX_ATTEMPTS and remain visible to
 * admins for manual retry. Provider integration is additive: today the only
 * registered handler is signed webhook delivery; email/SMS handlers require
 * provider secrets and are documented in docs/BUILD-PLAN.md.
 */
export const processOutboxV1 = onSchedule(
  { schedule: "every 5 minutes", secrets: [webhookSigningSecret], timeoutSeconds: 120 },
  async () => {
    const snapshot = await db
      .collectionGroup("outbox")
      .where("status", "==", "pending")
      .where("nextAttemptAt", "<=", Timestamp.now())
      .limit(outboxBatchSize.value())
      .get();

    let delivered = 0;
    let dead = 0;
    await Promise.all(
      snapshot.docs.map(async (document) => {
        const event = document.data() as OutboxEvent;
        const secret = webhookSigningSecret.value();
        const result = secret
          ? await deliverWebhook(event, secret)
          : {
              ok: false,
              error: "WEBHOOK_SIGNING_SECRET is not configured; delivery skipped.",
            };
        const nextAttempt = event.attempts + 1;
        const status = result.ok ? "delivered" : isDead(nextAttempt) ? "dead" : "pending";
        await document.ref.update({
          status,
          attempts: nextAttempt,
          error: result.ok ? null : (result.error ?? null),
          nextAttemptAt:
            status === "pending" ? Timestamp.fromDate(computeNextAttemptAt(nextAttempt)) : null,
          updatedAt: FieldValue.serverTimestamp(),
        });
        if (result.ok) delivered += 1;
        else if (status === "dead") dead += 1;
      }),
    );

    logger.info("Outbox processed", {
      processed: snapshot.size,
      delivered,
      dead,
      pending: snapshot.size - delivered - dead,
    });
  },
);
