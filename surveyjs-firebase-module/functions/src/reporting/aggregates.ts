import { Model } from "survey-core";
import type { SurveyJsJson } from "../contracts";

/**
 * Question types whose answers are free text or operational values. These are
 * intentionally never copied into aggregate documents because they can carry
 * PII (names, comments, contact details).
 */
const SKIPPED_TYPES = new Set([
  "text",
  "comment",
  "html",
  "file",
  "signaturepad",
  "password",
  "expression",
  "hidden",
  "image",
  "boilerplate",
]);

export interface QuestionCounts {
  questionType: string;
  counts: Record<string, number>;
  total: number;
}

function normalizeValues(value: unknown): unknown[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** Bound an aggregate key so untrusted answer values cannot create unbounded keys. */
function boundedKey(value: unknown, maximumLength = 200): string | null {
  const text = String(value);
  if (text.length === 0 || text.length > maximumLength) return null;
  return text;
}

/**
 * Computes per-question response counts for a single response document.
 * Free-text and operational question types are skipped entirely.
 */
export function questionCounts(
  schema: SurveyJsJson,
  answers: Record<string, unknown> | null | undefined,
): Record<string, QuestionCounts> {
  const result: Record<string, QuestionCounts> = {};
  if (!answers || typeof answers !== "object") return result;

  const model = new Model(schema);
  for (const question of model.getAllQuestions()) {
    const type = question.getType();
    if (SKIPPED_TYPES.has(type)) continue;
    const value = answers[question.name];
    if (value === undefined || value === null) continue;

    const entry: QuestionCounts = { questionType: type, counts: {}, total: 0 };
    for (const item of normalizeValues(value)) {
      if (item === null || item === undefined) continue;
      // Matrix answers are objects; flatten each row to "row: cell" keys.
      if (type === "matrix" && typeof item === "object") {
        for (const [row, cell] of Object.entries(item as Record<string, unknown>)) {
          const key = boundedKey(`${row}: ${String(cell)}`);
          if (key === null) continue;
          entry.counts[key] = (entry.counts[key] || 0) + 1;
          entry.total += 1;
        }
        continue;
      }
      const key = boundedKey(item);
      if (key === null) continue;
      entry.counts[key] = (entry.counts[key] || 0) + 1;
      entry.total += 1;
    }
    if (entry.total > 0) result[question.name] = entry;
  }
  return result;
}

export interface QuestionDeltaEntry {
  questionType: string;
  counts: Record<string, number>;
  total: number;
}

/**
 * Returns the increment map to apply to the questions aggregate document when a
 * response changes from `beforeAnswers` to `afterAnswers`. Only completed
 * responses feed the aggregate (callers pass answers only for completed
 * states), so the delta is retry-safe: applying it once per event receipt keeps
 * counts exact.
 */
export function questionDelta(
  schema: SurveyJsJson,
  beforeAnswers: Record<string, unknown> | null | undefined,
  afterAnswers: Record<string, unknown> | null | undefined,
): Record<string, QuestionDeltaEntry> {
  const before = questionCounts(schema, beforeAnswers);
  const after = questionCounts(schema, afterAnswers);
  const names = new Set([...Object.keys(before), ...Object.keys(after)]);
  const delta: Record<string, QuestionDeltaEntry> = {};

  for (const name of names) {
    const beforeEntry = before[name];
    const afterEntry = after[name];
    const questionType = afterEntry?.questionType || beforeEntry?.questionType || "unknown";
    const keys = new Set([
      ...Object.keys(beforeEntry?.counts || {}),
      ...Object.keys(afterEntry?.counts || {}),
    ]);
    const counts: Record<string, number> = {};
    let total = 0;
    for (const key of keys) {
      const difference = (afterEntry?.counts[key] || 0) - (beforeEntry?.counts[key] || 0);
      if (difference !== 0) counts[key] = difference;
      total += difference;
    }
    if (total !== 0 || Object.keys(counts).length > 0) {
      delta[name] = { questionType, counts, total };
    }
  }
  return delta;
}
