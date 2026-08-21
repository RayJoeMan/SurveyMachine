import { describe, expect, it } from "vitest";
import type { BuilderQuestion } from "./types";
import {
  builderToSurveyJs,
  conditionToVisibleIf,
  createQuestion,
  operatorsForQuestion,
  parseVisibleIf,
  slugifyTitle,
  surveyJsToBuilder,
  uniqueQuestionNames,
} from "./surveyBuilder";

function makeQuestion(partial: Partial<BuilderQuestion>): BuilderQuestion {
  return {
    id: partial.id ?? "q1",
    type: partial.type ?? "short_answer",
    title: partial.title ?? "What is your name?",
    required: partial.required ?? false,
    placeholder: partial.placeholder ?? "",
    options: partial.options ?? [],
    scale: partial.scale ?? 5,
    minLabel: partial.minLabel ?? "",
    maxLabel: partial.maxLabel ?? "",
    condition: partial.condition ?? null,
    rawVisibleIf: partial.rawVisibleIf,
  };
}

function elementsOf(schema: ReturnType<typeof builderToSurveyJs>): Record<string, unknown>[] {
  const pages = schema.pages as Record<string, unknown>[];
  return pages[0].elements as Record<string, unknown>[];
}

describe("slugifyTitle", () => {
  it("turns titles into lowercase snake names", () => {
    expect(slugifyTitle("How old is your child?")).toBe("how_old_is_your_child");
    expect(slugifyTitle("  Rate   your  experience ")).toBe("rate_your_experience");
    expect(slugifyTitle("!!!")).toBe("question");
  });
});

describe("uniqueQuestionNames", () => {
  it("dedupes duplicate titles with numeric suffixes", () => {
    const questions = [
      makeQuestion({ id: "a", title: "Favorite sport" }),
      makeQuestion({ id: "b", title: "Favorite sport" }),
      makeQuestion({ id: "c", title: "Favorite sport" }),
    ];
    const names = uniqueQuestionNames(questions);
    expect(names.get("a")).toBe("favorite_sport");
    expect(names.get("b")).toBe("favorite_sport_2");
    expect(names.get("c")).toBe("favorite_sport_3");
  });
});

describe("builderToSurveyJs question types", () => {
  it("compiles short answer to a text question", () => {
    const schema = builderToSurveyJs([makeQuestion({})], { title: "T", description: "D" });
    const [element] = elementsOf(schema);
    expect(element.type).toBe("text");
    expect(element.name).toBe("what_is_your_name");
    expect(element.isRequired).toBe(false);
  });

  it("compiles long answer to a comment with a cap", () => {
    const schema = builderToSurveyJs([makeQuestion({ type: "long_answer" })], {
      title: "T",
      description: "D",
    });
    const [element] = elementsOf(schema);
    expect(element.type).toBe("comment");
    expect(element.maxLength).toBe(2000);
  });

  it("compiles date to a text inputType date", () => {
    const schema = builderToSurveyJs([makeQuestion({ type: "date" })], {
      title: "T",
      description: "D",
    });
    const [element] = elementsOf(schema);
    expect(element.type).toBe("text");
    expect(element.inputType).toBe("date");
  });

  it("compiles single choice to radiogroup with options", () => {
    const schema = builderToSurveyJs(
      [makeQuestion({ type: "single_choice", options: ["A", "B", ""] })],
      { title: "T", description: "D" },
    );
    const [element] = elementsOf(schema);
    expect(element.type).toBe("radiogroup");
    expect(element.choices).toEqual(["A", "B"]);
  });

  it("compiles multiple choice to checkbox with options", () => {
    const schema = builderToSurveyJs(
      [makeQuestion({ type: "multiple_choice", options: ["X", "Y"] })],
      { title: "T", description: "D" },
    );
    const [element] = elementsOf(schema);
    expect(element.type).toBe("checkbox");
    expect(element.choices).toEqual(["X", "Y"]);
  });

  it("compiles yes/no to a boolean question", () => {
    const schema = builderToSurveyJs([makeQuestion({ type: "yes_no" })], {
      title: "T",
      description: "D",
    });
    const [element] = elementsOf(schema);
    expect(element.type).toBe("boolean");
  });

  it("compiles linear scale to a rating with 1-5 or 1-10", () => {
    const schema = builderToSurveyJs(
      [makeQuestion({ type: "linear_scale", scale: 10, minLabel: "Low", maxLabel: "High" })],
      { title: "T", description: "D" },
    );
    const [element] = elementsOf(schema);
    expect(element.type).toBe("rating");
    expect(element.rateMin).toBe(1);
    expect(element.rateMax).toBe(10);
    expect(element.rateCount).toBe(10);
    expect(element.minRateDescription).toBe("Low");
    expect(element.maxRateDescription).toBe("High");
  });

  it("compiles photo to a single-file image question", () => {
    const schema = builderToSurveyJs([makeQuestion({ type: "photo", title: "Show us your gear" })], {
      title: "T",
      description: "D",
    });
    const [element] = elementsOf(schema);
    expect(element.type).toBe("file");
    expect(element.storeDataAsText).toBe(false);
    expect(element.allowMultiple).toBe(false);
    expect(element.acceptedTypes).toBe("image/*");
    expect(element.maxSize).toBe(5 * 1024 * 1024);
  });

  it("limits photo conditions to answered/not-answered", () => {
    expect(operatorsForQuestion("photo")).toEqual(["answered", "not_answered"]);
  });
});

describe("conditionToVisibleIf", () => {
  const ref = { questionId: "q1", operator: "equals" as const, value: "Boys" };

  it("quotes text values", () => {
    expect(conditionToVisibleIf({ ...ref, value: "Boys" }, "program")).toBe("{program} = 'Boys'");
    expect(conditionToVisibleIf({ ...ref, operator: "not_equals" }, "program")).toBe(
      "{program} <> 'Boys'",
    );
    expect(conditionToVisibleIf({ ...ref, operator: "contains" }, "program")).toBe(
      "{program} contains 'Boys'",
    );
    expect(conditionToVisibleIf({ ...ref, operator: "not_contains" }, "program")).toBe(
      "not({program} contains 'Boys')",
    );
  });

  it("emits raw numbers for linear scales", () => {
    expect(
      conditionToVisibleIf({ ...ref, operator: "greater_than", value: "3" }, "rating", "linear_scale"),
    ).toBe("{rating} > 3");
    expect(
      conditionToVisibleIf({ ...ref, operator: "equals", value: "5" }, "rating", "linear_scale"),
    ).toBe("{rating} = 5");
  });

  it("emits raw booleans for yes/no", () => {
    expect(
      conditionToVisibleIf({ ...ref, operator: "equals", value: "true" }, "attended", "yes_no"),
    ).toBe("{attended} = true");
  });

  it("emits empty/notempty for answered operators", () => {
    expect(conditionToVisibleIf({ ...ref, operator: "answered" }, "program")).toBe(
      "{program} notempty",
    );
    expect(conditionToVisibleIf({ ...ref, operator: "not_answered" }, "program")).toBe(
      "{program} empty",
    );
  });
});

describe("parseVisibleIf", () => {
  const nameToId = new Map([["program", "q1"]]);

  it("parses equals/contains/answered forms", () => {
    expect(parseVisibleIf("{program} = 'Boys'", nameToId)).toEqual({
      questionId: "q1",
      operator: "equals",
      value: "Boys",
    });
    expect(parseVisibleIf("{program} contains 'Boys'", nameToId)).toEqual({
      questionId: "q1",
      operator: "contains",
      value: "Boys",
    });
    expect(parseVisibleIf("not({program} contains 'Boys')", nameToId)).toEqual({
      questionId: "q1",
      operator: "not_contains",
      value: "Boys",
    });
    expect(parseVisibleIf("{program} notempty", nameToId)).toEqual({
      questionId: "q1",
      operator: "answered",
      value: "",
    });
  });

  it("parses raw numbers and booleans", () => {
    expect(parseVisibleIf("{program} > 3", nameToId)).toEqual({
      questionId: "q1",
      operator: "greater_than",
      value: "3",
    });
    expect(parseVisibleIf("{program} = true", nameToId)).toEqual({
      questionId: "q1",
      operator: "equals",
      value: "true",
    });
  });

  it("returns null for unknown questions and complex expressions", () => {
    expect(parseVisibleIf("{missing} = 'x'", nameToId)).toBeNull();
    expect(parseVisibleIf("{program} = 'A' or {program} = 'B'", nameToId)).toBeNull();
  });
});

describe("surveyJsToBuilder round-trip", () => {
  it("round-trips all supported question types and conditions", () => {
    const source = builderToSurveyJs(
      [
        makeQuestion({ id: "a", type: "single_choice", title: "Program", options: ["A", "B"] }),
        makeQuestion({
          id: "b",
          type: "linear_scale",
          title: "Rating",
          scale: 10,
          condition: { questionId: "a", operator: "equals", value: "A" },
        }),
        makeQuestion({ id: "c", type: "yes_no", title: "Attended" }),
        makeQuestion({ id: "d", type: "date", title: "When" }),
        makeQuestion({ id: "e", type: "long_answer", title: "Notes" }),
        makeQuestion({ id: "f", type: "multiple_choice", title: "Topics", options: ["1", "2"] }),
        makeQuestion({ id: "g", type: "short_answer", title: "Name" }),
        makeQuestion({ id: "h", type: "photo", title: "Photo" }),
      ],
      { title: "My survey", description: "Desc" },
    );

    const parsed = surveyJsToBuilder(source);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.extras.elements).toEqual([]);
    expect(parsed.questions).toHaveLength(8);

    // Parsing regenerates stable ids; the condition must reference the
    // re-parsed single_choice question's id, not the original "a".
    const program = parsed.questions.find((question) => question.type === "single_choice");
    const rating = parsed.questions.find((question) => question.type === "linear_scale");
    expect(rating?.condition).toEqual({
      questionId: program?.id,
      operator: "equals",
      value: "A",
    });
    expect(rating?.scale).toBe(10);

    const rebuilt = builderToSurveyJs(parsed.questions, {
      title: "My survey",
      description: "Desc",
      extras: parsed.extras,
    });
    expect(rebuilt).toEqual(source);
  });

  it("preserves unrecognized elements as extras", () => {
    const schema = {
      title: "T",
      description: "D",
      pages: [
        {
          name: "p",
          elements: [
            { type: "text", name: "q1", title: "Hi" },
            { type: "html", name: "note", html: "<p>Hello</p>" },
          ],
        },
      ],
    } as Parameters<typeof surveyJsToBuilder>[0];
    const parsed = surveyJsToBuilder(schema);
    expect(parsed.questions).toHaveLength(1);
    expect(parsed.extras.elements).toHaveLength(1);
    const rebuilt = builderToSurveyJs(parsed.questions, {
      title: "T",
      description: "D",
      extras: parsed.extras,
    });
    const elements = elementsOf(rebuilt);
    expect(elements).toHaveLength(2);
    expect(elements[1]).toEqual({ type: "html", name: "note", html: "<p>Hello</p>" });
  });

  it("preserves complex visibleIf as a raw expression", () => {
    const schema = {
      title: "T",
      description: "D",
      pages: [
        {
          name: "p",
          elements: [
            { type: "radiogroup", name: "program", title: "Program", choices: ["A", "B"] },
            {
              type: "comment",
              name: "feedback",
              title: "Feedback",
              visibleIf: "{program} = 'A' or {program} = 'B'",
            },
          ],
        },
      ],
    } as Parameters<typeof surveyJsToBuilder>[0];
    const parsed = surveyJsToBuilder(schema);
    expect(parsed.warnings).toHaveLength(1);
    const feedback = parsed.questions.find((question) => question.id === parsed.questions[1].id);
    expect(feedback?.rawVisibleIf).toBe("{program} = 'A' or {program} = 'B'");

    const rebuilt = builderToSurveyJs(parsed.questions, {
      title: "T",
      description: "D",
      extras: parsed.extras,
    });
    const elements = elementsOf(rebuilt);
    expect(elements[1].visibleIf).toBe("{program} = 'A' or {program} = 'B'");
  });
});

describe("createQuestion", () => {
  it("starts choice questions with two empty options", () => {
    const single = createQuestion("single_choice");
    expect(single.options).toEqual(["", ""]);
    expect(createQuestion("multiple_choice").options).toEqual(["", ""]);
    expect(createQuestion("date").options).toEqual([]);
  });
});
