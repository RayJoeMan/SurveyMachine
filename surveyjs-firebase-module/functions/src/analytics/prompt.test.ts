import { describe, expect, it } from "vitest";
import { buildContextText, extractRecentTextAnswers } from "./prompt";

const schema = {
  pages: [
    {
      elements: [
        { name: "role", type: "radiogroup", title: "Your role" },
        { name: "feedback", type: "comment", title: "Feedback" },
        { name: "note", type: "text", title: "Anything else?" },
        { name: "skip", type: "expression" },
      ],
    },
  ],
};

describe("extractRecentTextAnswers", () => {
  it("collects only text/comment answers, most recent first", () => {
    const responses = [
      { answers: { role: "player", feedback: "Great season", note: "More games", skip: "x" } },
      { answers: { role: "coach", feedback: "Coaches were great", note: "" } },
      { answers: { role: "parent", feedback: 42 } },
    ];
    const collected = extractRecentTextAnswers(schema, responses);
    expect(collected).toEqual([
      { question: "Feedback", answer: "Great season" },
      { question: "Anything else?", answer: "More games" },
      { question: "Feedback", answer: "Coaches were great" },
    ]);
  });

  it("bounds the number of items and answer length", () => {
    const long = "x".repeat(500);
    const responses = Array.from({ length: 40 }, () => ({
      answers: { feedback: long },
    }));
    const collected = extractRecentTextAnswers(schema, responses, 10, 100);
    expect(collected).toHaveLength(10);
    expect(collected.every((entry) => entry.answer.length <= 100)).toBe(true);
  });
});

describe("buildContextText", () => {
  it("serializes a bounded context without raw identities", () => {
    const text = buildContextText({
      orgName: "Test Org",
      surveyTitle: "End of Season",
      surveyDescription: "Feedback",
      summary: { completed: 3, inProgress: 1, totalDurationMs: 180_000 },
      aggregates: { role: { questionType: "radiogroup", total: 3, counts: { player: 2 } } },
      recentTextAnswers: [{ question: "Feedback", answer: "Great" }],
    });
    expect(text).toContain('"completed": 3');
    expect(text).toContain('"player": 2');
    expect(text).toContain('"totalDurationMinutes": 3');
    expect(text).not.toContain("joermnd");
  });
});
