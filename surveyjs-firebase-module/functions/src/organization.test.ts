import { describe, expect, it } from "vitest";
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
