import { describe, expect, it } from "vitest";
import { OUTBOX_MAX_ATTEMPTS } from "../contracts";
import { computeNextAttemptAt, isDead, redactError } from "./outbox";

describe("outbox scheduling", () => {
  it("backs off exponentially from one minute, capped at one hour", () => {
    const now = Date.UTC(2026, 7, 16, 12, 0, 0);
    expect(computeNextAttemptAt(1, now, 0).getTime() - now).toBe(60_000);
    expect(computeNextAttemptAt(2, now, 0).getTime() - now).toBe(120_000);
    expect(computeNextAttemptAt(3, now, 0).getTime() - now).toBe(240_000);
    expect(computeNextAttemptAt(10, now, 0).getTime() - now).toBe(60 * 60_000);
  });

  it("marks an event dead only after the maximum attempts", () => {
    expect(isDead(OUTBOX_MAX_ATTEMPTS - 1)).toBe(false);
    expect(isDead(OUTBOX_MAX_ATTEMPTS)).toBe(true);
  });

  it("redacts and bounds error text", () => {
    expect(redactError(new Error("boom"))).toBe("boom");
    expect(redactError("x".repeat(2_000)).length).toBeLessThanOrEqual(500);
    expect(redactError(undefined)).toBe("undefined");
  });
});
