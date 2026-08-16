import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { db } from "./firebase";

export async function safeAudit(input: {
  orgId: string;
  actorUid: string;
  action: string;
  resourceType: string;
  resourceId: string;
  requestId: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.collection(`organizations/${input.orgId}/auditLogs`).add({
      actorUid: input.actorUid,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      requestId: input.requestId,
      details: input.details || {},
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    logger.error("Audit write failed", { requestId: input.requestId, action: input.action, error });
  }
}
