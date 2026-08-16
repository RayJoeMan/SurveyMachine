import { describe, expect, it } from "vitest";
import { isReservedOrgId, slugifyOrganizationName } from "./contracts";
import { orgExportStoragePath } from "./organization";

describe("organization export", () => {
  it("builds a stable, scoped storage path", () => {
    const path = orgExportStoragePath("acme", "1700000000000-abc.json");
    expect(path).toBe("survey-exports/acme/org-data/1700000000000-abc.json");
  });

  it("keeps exports inside the org-scoped survey-exports prefix", () => {
    expect(orgExportStoragePath("acme", "x.json")).toMatch(/^survey-exports\/acme\/org-data\//);
  });
});

describe("organization identifiers", () => {
  it("slugifies a display name into a deterministic identifier", () => {
    expect(slugifyOrganizationName("Northside Youth Sports")).toBe("northside-youth-sports");
    expect(slugifyOrganizationName("  Acme, Inc. ")).toBe("acme-inc");
  });

  it("falls back to a safe slug for unusable names", () => {
    expect(slugifyOrganizationName("!!!")).toBe("organization");
  });

  it("rejects reserved identifiers", () => {
    expect(isReservedOrgId("demo")).toBe(true);
    expect(isReservedOrgId("admin")).toBe(true);
    expect(isReservedOrgId("acme")).toBe(false);
  });
});
