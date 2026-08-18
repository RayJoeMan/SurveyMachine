/**
 * Visual survey builder domain types.
 *
 * The builder is a small, opinionated layer on top of the SurveyJS JSON that
 * the rest of the product already understands (public renderer, aggregate
 * engine, AI analytics, exports). Questions are edited as typed records here
 * and compiled to SurveyJS JSON before saving, so every downstream system
 * keeps working unchanged.
 */

export type BuilderQuestionType =
  | "short_answer"
  | "long_answer"
  | "date"
  | "single_choice"
  | "multiple_choice"
  | "yes_no"
  | "linear_scale";

export const QUESTION_TYPE_LABELS: Record<BuilderQuestionType, string> = {
  short_answer: "Short answer",
  long_answer: "Long answer",
  date: "Date",
  single_choice: "Single choice",
  multiple_choice: "Multiple choice",
  yes_no: "Yes / No",
  linear_scale: "Linear scale (1–5 or 1–10)",
};

export const BUILDER_QUESTION_TYPES: BuilderQuestionType[] = [
  "short_answer",
  "long_answer",
  "date",
  "single_choice",
  "multiple_choice",
  "yes_no",
  "linear_scale",
];

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "answered"
  | "not_answered"
  | "greater_than"
  | "less_than";

export const CONDITION_OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: "is",
  not_equals: "is not",
  contains: "contains",
  not_contains: "does not contain",
  answered: "is answered",
  not_answered: "is not answered",
  greater_than: "is greater than",
  less_than: "is less than",
};

/**
 * A single conditional visibility rule. The referenced question is stored by
 * its stable builder id so renaming a question's title never breaks rules.
 * Values are stored in string form; they are quoted/typed correctly when the
 * rule is compiled to a SurveyJS `visibleIf` expression.
 */
export interface ConditionRule {
  questionId: string;
  operator: ConditionOperator;
  value: string;
}

export interface BuilderQuestion {
  id: string;
  type: BuilderQuestionType;
  title: string;
  required: boolean;
  placeholder: string;
  options: string[];
  scale: 5 | 10;
  minLabel: string;
  maxLabel: string;
  condition: ConditionRule | null;
  /**
   * Present only when an existing `visibleIf` expression is too complex for
   * the builder to edit (e.g. `a or b`). The raw expression is preserved
   * verbatim in the compiled JSON so nothing is lost.
   */
  rawVisibleIf?: string;
}

/** Survey-level properties and elements the builder does not model. */
export interface BuilderExtras {
  surveyProps: Record<string, unknown>;
  elements: Record<string, unknown>[];
}

export interface ParsedSurvey {
  questions: BuilderQuestion[];
  extras: BuilderExtras;
  warnings: string[];
}
