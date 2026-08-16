import { describe, expect, it } from "vitest";
import { rateLimitKey } from "./rateLimit";

describe("rate limit keys", () => {
  it("derives a deterministic bounded key from an identity", () => {
    const first = rateLimitKey("submit:survey-a", "203.0.113.7");
    const second = rateLimitKey("submit:survey-a", "203.0.113.7");
    expect(first).toBe(second);
    expect(first).toMatch(/^submit:survey-a:[a-f0-9]{24}$/);
  });

  it("never stores the raw identity", () => {
    const raw = "203.0.113.7";
    const key = rateLimitKey("submit:survey-a", raw);
    expect(key).not.toContain(raw);
  });

  it("separates prefixes and identities", () => {
    expect(rateLimitKey("submit:survey-a", "x")).not.toBe(rateLimitKey("progress:survey-a", "x"));
    expect(rateLimitKey("submit:survey-a", "x")).not.toBe(rateLimitKey("submit:survey-a", "y"));
  });
});
