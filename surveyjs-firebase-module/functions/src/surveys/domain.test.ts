import { describe, expect, it } from "vitest";
import {
  sanitizeSurveyAnswers,
  responseDocumentId,
  safeDurationMs,
  validateSurveyDefinition,
} from "./domain";

const schema = {
  elements: [
    { type: "text", name: "name", isRequired: true },
    { type: "radiogroup", name: "choice", choices: ["A", "B"] },
  ],
};

function expectValidationError(surveySchema: Record<string, unknown>, pattern: RegExp): void {
  expect(() => validateSurveyDefinition(surveySchema)).toThrow(pattern);
}

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

describe("survey definition validation", () => {
  it("accepts a valid schema", () => {
    expect(() => validateSurveyDefinition(schema)).not.toThrow();
  });

  it("rejects duplicate question names", () => {
    expectValidationError(
      {
        elements: [
          { type: "text", name: "duplicate" },
          { type: "text", name: "duplicate" },
        ],
      },
      /Question names must be unique/,
    );
  });

  it("rejects questions without a stable name", () => {
    expectValidationError(
      { elements: [{ type: "text", name: "" }] },
      /stable name under 160 characters/,
    );
  });

  it("rejects file questions while uploads are disabled", () => {
    expectValidationError(
      { elements: [{ type: "file", name: "photo" }] },
      /File questions cannot be used while file uploads are disabled/,
    );
  });

  it("rejects surveys over the page limit", () => {
    const pages = Array.from({ length: 51 }, (_, index) => ({
      name: `page-${index}`,
      elements: [{ type: "text", name: `q-${index}` }],
    }));
    expectValidationError({ pages }, /limited to 50 pages/);
  });

  it("rejects surveys over the question limit", () => {
    const questions = Array.from({ length: 501 }, (_, index) => ({
      type: "text",
      name: `q-${index}`,
    }));
    expectValidationError({ elements: questions }, /limited to 500 questions/);
  });
});
