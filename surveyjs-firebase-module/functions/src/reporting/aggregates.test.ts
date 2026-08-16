import { describe, expect, it } from "vitest";
import { questionCounts, questionDelta } from "./aggregates";

const schema = {
  elements: [
    { type: "rating", name: "enjoyment" },
    { type: "boolean", name: "recommend" },
    { type: "radiogroup", name: "division", choices: ["Boys", "Girls"] },
    { type: "checkbox", name: "weekdays", choices: ["Mon", "Tue", "Wed"] },
    {
      type: "matrix",
      name: "coachRatings",
      columns: ["Strongly agree", "Disagree"],
      rows: ["Communicates", "Is fair"],
    },
    { type: "text", name: "name" },
    { type: "comment", name: "feedback" },
  ],
};

describe("question aggregates", () => {
  it("counts rating, boolean, single, multiple, and matrix answers", () => {
    const counts = questionCounts(schema, {
      enjoyment: 4,
      recommend: true,
      division: "Girls",
      weekdays: ["Mon", "Wed"],
      coachRatings: { Communicates: "Strongly agree", "Is fair": "Disagree" },
    });
    expect(counts.enjoyment.counts).toEqual({ "4": 1 });
    expect(counts.recommend.counts).toEqual({ true: 1 });
    expect(counts.division.counts).toEqual({ Girls: 1 });
    expect(counts.weekdays.counts).toEqual({ Mon: 1, Wed: 1 });
    expect(counts.weekdays.total).toBe(2);
    expect(counts.coachRatings.counts).toEqual({
      "Communicates: Strongly agree": 1,
      "Is fair: Disagree": 1,
    });
  });

  it("never copies free text or comment answers into aggregates", () => {
    const counts = questionCounts(schema, { name: "Pat Smith", feedback: "Long free text." });
    expect(counts.name).toBeUndefined();
    expect(counts.feedback).toBeUndefined();
  });

  it("ignores null, undefined, and overlong keys", () => {
    const counts = questionCounts(schema, {
      division: null,
      weekdays: [undefined, "A".repeat(300)],
    });
    expect(counts.division).toBeUndefined();
    expect(counts.weekdays).toBeUndefined();
  });

  it("computes a retry-safe delta between two completed responses", () => {
    const delta = questionDelta(
      schema,
      { division: "Boys", weekdays: ["Mon"] },
      { division: "Girls", weekdays: ["Mon", "Wed"] },
    );
    expect(delta.division.counts).toEqual({ Boys: -1, Girls: 1 });
    expect(delta.weekdays.counts).toEqual({ Wed: 1 });
    expect(delta.weekdays.total).toBe(1);
  });

  it("returns an empty delta when nothing changed", () => {
    expect(questionDelta(schema, { division: "Boys" }, { division: "Boys" })).toEqual({});
  });
});
