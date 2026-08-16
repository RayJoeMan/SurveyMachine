import { describe, expect, it } from "vitest";
import { sanitizeSurveyAnswers, responseDocumentId, safeDurationMs } from "./domain";

const schema = {
  elements: [
    { type: "text", name: "name", isRequired: true },
    { type: "radiogroup", name: "choice", choices: ["A", "B"] },
  ],
};

describe("survey response domain", () => {
  it("removes unknown answer keys and invalid choices", () => {
    expect(
      sanitizeSurveyAnswers(schema, { name: "Pat", choice: "C", injected: "discard" }, false),
    ).toEqual({ name: "Pat" });
  });

  it("rejects a missing visible required answer", () => {
    expect(() => sanitizeSurveyAnswers(schema, {}, true)).toThrow(/Required survey answers/);
  });

  it("creates stable opaque response identifiers", () => {
    const first = responseDocumentId("survey-a", "a0fbb2f5-47f0-40d7-b08f-97c55c20a731");
    const second = responseDocumentId("survey-a", "a0fbb2f5-47f0-40d7-b08f-97c55c20a731");
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it("clamps client duration to a safe range", () => {
    expect(safeDurationMs(new Date(Date.now() + 60_000).toISOString())).toBe(0);
    expect(safeDurationMs("2000-01-01T00:00:00.000Z")).toBe(30 * 24 * 60 * 60 * 1_000);
  });
});
