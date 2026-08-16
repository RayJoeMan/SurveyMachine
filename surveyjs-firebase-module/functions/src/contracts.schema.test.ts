import { describe, expect, it } from "vitest";
import { ResponseMetadataSchema } from "./contracts";

describe("ResponseMetadataSchema", () => {
  it("normalizes null metadata entries produced by the callable protocol", () => {
    const parsed = ResponseMetadataSchema.safeParse({
      source: null,
      campaign: null,
      medium: null,
      referrerHost: null,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual({});
  });

  it("keeps provided metadata values and drops absent ones", () => {
    const parsed = ResponseMetadataSchema.safeParse({
      source: "google",
      campaign: "spring",
      medium: null,
      referrerHost: "example.com",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({
        source: "google",
        campaign: "spring",
        referrerHost: "example.com",
      });
    }
  });

  it("rejects unknown metadata keys", () => {
    const parsed = ResponseMetadataSchema.safeParse({ extra: "x" });
    expect(parsed.success).toBe(false);
  });
});
