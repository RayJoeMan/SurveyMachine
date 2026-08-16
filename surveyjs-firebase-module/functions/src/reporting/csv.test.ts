import { describe, expect, it } from "vitest";
import { responsesToCsv } from "./csv";

describe("responsesToCsv", () => {
  it("unions answer columns and escapes quotes", () => {
    const csv = responsesToCsv([
      {
        responseId: "one",
        status: "completed",
        surveyVersion: 1,
        answers: { feedback: 'Great "season"', score: 5 },
      },
    ]);
    expect(csv).toContain('"feedback","score"');
    expect(csv).toContain('"Great ""season"""');
  });

  it("neutralizes spreadsheet formulas", () => {
    const csv = responsesToCsv([
      {
        responseId: "one",
        status: "completed",
        surveyVersion: 1,
        answers: { feedback: '=HYPERLINK("bad")' },
      },
    ]);
    expect(csv).toContain("'=HYPERLINK");
  });
});
