import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { db } from "./firebase";

export interface RateLimitOptions {
  /** Maximum events allowed per sliding window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Bounded, privacy-safe key. Never pass a raw IP address. */
  key: string;
  /** Human label used in the resource-exhausted error. */
  label: string;
}

/**
 * Derives a bounded abuse-control key from an identity factor without storing
 * the raw value. `identity` may be an IP-derived value or a user/session id;
 * only its SHA-256 hash is persisted, never the raw input.
 */
export function rateLimitKey(prefix: string, identity: string): string {
  return `${prefix}:${createHash("sha256").update(identity).digest("hex").slice(0, 24)}`;
}

/**
 * Enforces a per-key sliding-window limit using a single counter document.
 * Throws `resource-exhausted` when the limit is exceeded. Counter documents
 * live under the top-level `rateLimits/` collection and are never written by
 * browsers.
 *
 * Note: this is abuse damping with bounded false positives, not a precision
 * quota. It does not persist raw IP addresses.
 */
export async function enforceRateLimit(options: RateLimitOptions): Promise<void> {
  const ref = db.doc(`rateLimits/${options.key}`);
  const now = Date.now();
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const windowStart = Number(snapshot.get("windowStart") || now);
    const count = Number(snapshot.get("count") || 0);
    const withinWindow = now - windowStart < options.windowMs;
    const currentWindowStart = withinWindow ? windowStart : now;
    const currentCount = withinWindow ? count : 0;

    if (currentCount >= options.limit) {
      throw new HttpsError(
        "resource-exhausted",
        `${options.label} rate limit reached. Please try again later.`,
      );
    }
    transaction.set(
      ref,
      {
        key: options.key,
        windowStart: currentWindowStart,
        count: currentCount + 1,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
}
