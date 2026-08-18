import { useState } from "react";
import type {
  BuilderQuestion,
  BuilderQuestionType,
  ConditionOperator,
  ConditionRule,
} from "@/modules/admin/builder/types";
import {
  BUILDER_QUESTION_TYPES,
  CONDITION_OPERATOR_LABELS,
  QUESTION_TYPE_LABELS,
} from "@/modules/admin/builder/types";
import {
  createQuestion,
  operatorsForQuestion,
  uniqueQuestionNames,
} from "@/modules/admin/builder/surveyBuilder";

interface QuestionBuilderProps {
  questions: BuilderQuestion[];
  onChange: (questions: BuilderQuestion[]) => void;
  extrasCount: number;
  warnings: string[];
}

const TEXT_TYPES = new Set<BuilderQuestionType>(["short_answer", "long_answer", "date"]);
const CHOICE_TYPES = new Set<BuilderQuestionType>(["single_choice", "multiple_choice"]);

function ConditionValue({
  referenced,
  condition,
  onChange,
}: {
  referenced: BuilderQuestion | undefined;
  condition: ConditionRule;
  onChange: (condition: ConditionRule) => void;
}) {
  const type = referenced?.type;
  const isChoiceCompare =
    (type === "single_choice" || type === "multiple_choice") &&
    (condition.operator === "equals" ||
      condition.operator === "not_equals" ||
      condition.operator === "contains" ||
      condition.operator === "not_contains");

  if (isChoiceCompare && referenced) {
    const options = referenced.options.map((option) => option.trim()).filter(Boolean);
    return (
      <label>
        Value
        <select
          value={condition.value}
          onChange={(event) => onChange({ ...condition, value: event.target.value })}
        >
          <option value="" disabled>
            Choose an option…
          </option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (type === "yes_no") {
    return (
      <label>
        Value
        <select
          value={condition.value}
          onChange={(event) => onChange({ ...condition, value: event.target.value })}
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </label>
    );
  }

  if (
    type === "linear_scale" &&
    (condition.operator === "equals" ||
      condition.operator === "not_equals" ||
      condition.operator === "greater_than" ||
      condition.operator === "less_than")
  ) {
    const scale = referenced?.scale ?? 5;
    return (
      <label>
        Value (1–{scale})
        <select
          value={condition.value}
          onChange={(event) => onChange({ ...condition, value: event.target.value })}
        >
          {Array.from({ length: scale }, (_, index) => index + 1).map((number) => (
            <option key={number} value={String(number)}>
              {number}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label>
      Value
      <input
        value={condition.value}
        onChange={(event) => onChange({ ...condition, value: event.target.value })}
      />
    </label>
  );
}

function ConditionEditor({
  target,
  questions,
  onChange,
}: {
  target: BuilderQuestion;
  questions: BuilderQuestion[];
  onChange: (condition: ConditionRule | null) => void;
}) {
  const condition = target.condition;
  const referenced = questions.find((question) => question.id === condition?.questionId);
  const operators = referenced
    ? operatorsForQuestion(referenced.type)
    : (["equals", "not_equals", "contains", "not_contains", "answered", "not_answered"] as ConditionOperator[]);
  const needsValue = condition
    ? condition.operator !== "answered" && condition.operator !== "not_answered"
    : false;

  function pickQuestion(questionId: string) {
    const ref = questions.find((question) => question.id === questionId);
    const first = operatorsForQuestion(ref?.type ?? "short_answer")[0];
    onChange({ questionId, operator: first, value: "" });
  }

  return (
    <div className="condition-editor">
      <div className="condition-heading">Show this question when</div>
      <div className="field-row">
        <label>
          <span className="sr-only">Trigger question</span>
          <select
            value={condition?.questionId ?? ""}
            onChange={(event) => pickQuestion(event.target.value)}
          >
            <option value="" disabled>
              Choose a question…
            </option>
            {questions
              .filter((question) => question.id !== target.id)
              .map((question) => (
                <option key={question.id} value={question.id}>
                  {question.title.trim() || "Untitled question"}
                </option>
              ))}
          </select>
        </label>
        {condition && (
          <label>
            <span className="sr-only">Operator</span>
            <select
              value={condition.operator}
              onChange={(event) =>
                onChange({ ...condition, operator: event.target.value as ConditionOperator })
              }
            >
              {operators.map((operator) => (
                <option key={operator} value={operator}>
                  {CONDITION_OPERATOR_LABELS[operator]}
                </option>
              ))}
            </select>
          </label>
        )}
        {condition && needsValue && (
          <ConditionValue referenced={referenced} condition={condition} onChange={onChange} />
        )}
      </div>
      {condition && (
        <button type="button" className="text-button" onClick={() => onChange(null)}>
          Remove condition
        </button>
      )}
    </div>
  );
}

export function QuestionBuilder({
  questions,
  onChange,
  extrasCount,
  warnings,
}: QuestionBuilderProps) {
  const [addType, setAddType] = useState<BuilderQuestionType>("short_answer");
  const names = uniqueQuestionNames(questions);

  function updateQuestion(id: string, patch: Partial<BuilderQuestion>) {
    onChange(questions.map((question) => (question.id === id ? { ...question, ...patch } : question)));
  }

  function addQuestion() {
    onChange([...questions, createQuestion(addType)]);
  }

  function removeQuestion(id: string) {
    onChange(questions.filter((question) => question.id !== id));
  }

  function moveQuestion(id: string, direction: -1 | 1) {
    const index = questions.findIndex((question) => question.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function updateOption(id: string, optionIndex: number, value: string) {
    const source = questions.find((question) => question.id === id);
    updateQuestion(id, {
      options: source?.options.map((option, index) => (index === optionIndex ? value : option)) ?? [],
    });
  }

  function addOption(id: string) {
    const source = questions.find((question) => question.id === id);
    updateQuestion(id, { options: [...(source?.options ?? []), ""] });
  }

  function removeOption(id: string, optionIndex: number) {
    const source = questions.find((question) => question.id === id);
    updateQuestion(id, {
      options: (source?.options ?? []).filter((_, index) => index !== optionIndex),
    });
  }

  return (
    <div className="question-builder">
      <div className="builder-toolbar">
        <div className="builder-toolbar__label">
          <strong>{questions.length}</strong> {questions.length === 1 ? "question" : "questions"}
        </div>
        <div className="builder-toolbar__add">
          <label className="sr-only" htmlFor="builder-add-type">
            Question type
          </label>
          <select
            id="builder-add-type"
            value={addType}
            onChange={(event) => setAddType(event.target.value as BuilderQuestionType)}
          >
            {BUILDER_QUESTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {QUESTION_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          <button className="button" type="button" onClick={addQuestion}>
            Add question
          </button>
        </div>
      </div>

      {extrasCount > 0 && (
        <p className="builder-note">
          {extrasCount} custom element{extrasCount === 1 ? "" : "s"} from the JSON are preserved
          and will be included when you save. Use the JSON tab to edit them.
        </p>
      )}
      {warnings.map((warning) => (
        <p key={warning} className="builder-note builder-note--warning" role="note">
          {warning}
        </p>
      ))}

      {questions.length === 0 && (
        <div className="builder-empty">
          <p>No questions yet. Add your first question above.</p>
        </div>
      )}

      <ol className="builder-question-list">
        {questions.map((question, index) => (
          <li key={question.id} className="builder-question">
            <div className="builder-question__header">
              <span className="builder-type-badge">{QUESTION_TYPE_LABELS[question.type]}</span>
              <div className="builder-question__actions">
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Move question up"
                  disabled={index === 0}
                  onClick={() => moveQuestion(question.id, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Move question down"
                  disabled={index === questions.length - 1}
                  onClick={() => moveQuestion(question.id, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="icon-button icon-button--danger"
                  aria-label={`Delete question ${index + 1}`}
                  onClick={() => removeQuestion(question.id)}
                >
                  ✕
                </button>
              </div>
            </div>

            <label className="builder-question__title">
              <span className="sr-only">Question text</span>
              <input
                value={question.title}
                placeholder="Enter the question…"
                onChange={(event) => updateQuestion(question.id, { title: event.target.value })}
              />
            </label>
            <p className="builder-name-hint">
              Reporting key: <code>{names.get(question.id) ?? question.id}</code>
            </p>

            <div className="builder-question__fields">
              {TEXT_TYPES.has(question.type) && (
                <label>
                  Placeholder (optional)
                  <input
                    value={question.placeholder}
                    placeholder={question.type === "date" ? "e.g. YYYY-MM-DD" : "Optional helper text…"}
                    onChange={(event) =>
                      updateQuestion(question.id, { placeholder: event.target.value })
                    }
                  />
                </label>
              )}

              {CHOICE_TYPES.has(question.type) && (
                <fieldset className="option-editor">
                  <legend>Options</legend>
                  {question.options.map((option, optionIndex) => (
                    <div key={optionIndex} className="option-row">
                      <input
                        aria-label={`Option ${optionIndex + 1}`}
                        value={option}
                        placeholder={`Option ${optionIndex + 1}`}
                        onChange={(event) => updateOption(question.id, optionIndex, event.target.value)}
                      />
                      <button
                        type="button"
                        className="icon-button icon-button--danger"
                        aria-label={`Remove option ${optionIndex + 1}`}
                        onClick={() => removeOption(question.id, optionIndex)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button type="button" className="text-button" onClick={() => addOption(question.id)}>
                    + Add option
                  </button>
                </fieldset>
              )}

              {question.type === "linear_scale" && (
                <div className="scale-editor">
                  <div className="scale-editor__labels">
                    <label>
                      Low label (optional)
                      <input
                        value={question.minLabel}
                        placeholder="e.g. Not at all likely"
                        onChange={(event) =>
                          updateQuestion(question.id, { minLabel: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      High label (optional)
                      <input
                        value={question.maxLabel}
                        placeholder="e.g. Extremely likely"
                        onChange={(event) =>
                          updateQuestion(question.id, { maxLabel: event.target.value })
                        }
                      />
                    </label>
                  </div>
                  <fieldset className="scale-picker">
                    <legend>Scale range</legend>
                    {([5, 10] as const).map((scale) => (
                      <label key={scale} className="scale-picker__option">
                        <input
                          type="radio"
                          name={`scale-${question.id}`}
                          checked={question.scale === scale}
                          onChange={() => updateQuestion(question.id, { scale })}
                        />
                        1–{scale}
                      </label>
                    ))}
                  </fieldset>
                </div>
              )}

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={question.required}
                  onChange={(event) => updateQuestion(question.id, { required: event.target.checked })}
                />
                Required
              </label>
            </div>

            {question.rawVisibleIf && (
              <p className="builder-note builder-note--warning" role="note">
                This question has a saved conditional expression that is preserved as-is.
              </p>
            )}

            <ConditionEditor
              target={question}
              questions={questions}
              onChange={(condition) => updateQuestion(question.id, { condition })}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
