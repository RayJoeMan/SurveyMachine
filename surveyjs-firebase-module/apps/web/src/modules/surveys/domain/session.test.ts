import { beforeEach, describe, expect, it } from "vitest";
import {
  clearLocalSurveySession,
  getOrCreateSurveySession,
  loadLocalAnswers,
  saveLocalAnswers,
} from "./session";

describe("local survey session", () => {
  beforeEach(() => localStorage.clear());

  it("keeps one idempotency identifier across refreshes", () => {
    const first = getOrCreateSurveySession("survey-one");
    const second = getOrCreateSurveySession("survey-one");
    expect(second.clientSubmissionId).toBe(first.clientSubmissionId);
  });

  it("stores and clears local draft answers", () => {
    saveLocalAnswers("survey-one", { rating: 5 });
    expect(loadLocalAnswers("survey-one")).toEqual({ rating: 5 });
    clearLocalSurveySession("survey-one");
    expect(loadLocalAnswers("survey-one")).toEqual({});
  });
});
