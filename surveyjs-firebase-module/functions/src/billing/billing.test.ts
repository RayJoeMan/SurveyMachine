import { describe, expect, it } from "vitest";
import { getOrCreatePlanPrice, getStripe } from "./stripe";
import { entitlementEnabled, normalizeSubscriptionStatus, planFromMetadata } from "./webhook";

describe("stripe client", () => {
  it("returns null when STRIPE_SECRET_KEY is unset", () => {
    const previous = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    try {
      expect(getStripe()).toBeNull();
    } finally {
      if (previous !== undefined) process.env.STRIPE_SECRET_KEY = previous;
    }
  });
});

describe("getOrCreatePlanPrice", () => {
  it("rejects the free plan before any Stripe call", async () => {
    // A plan with no configured amount must be rejected before any Stripe call.
    await expect(getOrCreatePlanPrice({} as never, "free", 49)).rejects.toThrow();
  });
});

describe("subscription status normalization", () => {
  it("maps Stripe statuses to the compact platform statuses", () => {
    expect(normalizeSubscriptionStatus("active")).toBe("active");
    expect(normalizeSubscriptionStatus("trialing")).toBe("trialing");
    expect(normalizeSubscriptionStatus("past_due")).toBe("past_due");
    expect(normalizeSubscriptionStatus("incomplete")).toBe("incomplete");
    expect(normalizeSubscriptionStatus("canceled")).toBe("canceled");
    expect(normalizeSubscriptionStatus("unpaid")).toBe("canceled");
    expect(normalizeSubscriptionStatus("incomplete_expired")).toBe("canceled");
  });
});

describe("plan metadata", () => {
  it("parses valid plan metadata and ignores invalid values", () => {
    expect(planFromMetadata({ sm_plan: "pro" })).toBe("pro");
    expect(planFromMetadata({ sm_plan: "enterprise" })).toBe("enterprise");
    expect(planFromMetadata({ sm_plan: "bogus" })).toBeNull();
    expect(planFromMetadata(undefined)).toBeNull();
  });
});

describe("entitlement gating", () => {
  it("enables the module only for active or trialing subscriptions", () => {
    expect(entitlementEnabled("active")).toBe(true);
    expect(entitlementEnabled("trialing")).toBe(true);
    expect(entitlementEnabled("past_due")).toBe(false);
    expect(entitlementEnabled("incomplete")).toBe(false);
    expect(entitlementEnabled("canceled")).toBe(false);
  });
});
