import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";

const { membershipGet } = vi.hoisted(() => ({ membershipGet: vi.fn() }));

vi.mock("./firebase", () => ({
  db: {
    doc: vi.fn(() => ({
      get: membershipGet,
    })),
  },
}));

import { assertRole, assertSuperAdmin } from "./permissions";

describe("assertRole", () => {
  beforeEach(() => {
    membershipGet.mockReset();
  });

  it("rejects a missing uid", async () => {
    await expect(assertRole("org", undefined, ["org_admin"])).rejects.toBeInstanceOf(HttpsError);
  });

  it("allows a super-admin email without any membership document", async () => {
    membershipGet.mockResolvedValue({ exists: false });
    await expect(
      assertRole("org", "uid-1", ["org_admin"], "joermnd@gmail.com"),
    ).resolves.toBeUndefined();
    expect(membershipGet).not.toHaveBeenCalled();
  });

  it("still enforces membership for a non-super-admin email", async () => {
    membershipGet.mockResolvedValue({ exists: false });
    await expect(
      assertRole("org", "uid-1", ["org_admin"], "someone@example.com"),
    ).rejects.toBeInstanceOf(HttpsError);
  });

  it("rejects a role the member does not hold", async () => {
    membershipGet.mockResolvedValue({ exists: true, get: () => ["survey_editor"] });
    await expect(
      assertRole("org", "uid-1", ["org_admin"], "someone@example.com"),
    ).rejects.toBeInstanceOf(HttpsError);
  });

  it("allows a member holding the required role", async () => {
    membershipGet.mockResolvedValue({ exists: true, get: () => ["org_admin"] });
    await expect(
      assertRole("org", "uid-1", ["org_admin"], "someone@example.com"),
    ).resolves.toBeUndefined();
  });
});

describe("assertSuperAdmin", () => {
  it("allows the configured super-admin email", () => {
    expect(() => assertSuperAdmin("joermnd@gmail.com")).not.toThrow();
  });

  it("rejects any other account", () => {
    expect(() => assertSuperAdmin("other@example.com")).toThrow();
    expect(() => assertSuperAdmin(undefined)).toThrow();
  });
});
