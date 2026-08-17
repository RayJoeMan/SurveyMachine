import type { SurveyJsJson } from "../contracts";

export interface AggregateShape {
  questionType?: string;
  total?: number;
  counts?: Record<string, number>;
}
export type AggregatesShape = Record<string, AggregateShape>;

export interface ContextInput {
  orgName: string;
  surveyTitle: string;
  surveyDescription: string;
  summary: { completed: number; inProgress: number; totalDurationMs: number };
  aggregates: AggregatesShape;
  recentTextAnswers: Array<{ question: string; answer: string }>;
}

/** Compact, bounded JSON context fed to the LLM. Never includes raw identities. */
export function buildContextText(input: ContextInput): string {
  return JSON.stringify(
    {
      organization: input.orgName,
      survey: input.surveyTitle,
      description: input.surveyDescription,
      summary: {
        completed: input.summary.completed,
        inProgress: input.summary.inProgress,
        totalDurationMinutes: Math.round(input.summary.totalDurationMs / 60_000),
      },
      questionDistributions: input.aggregates,
      recentTextAnswers: input.recentTextAnswers,
    },
    null,
    1,
  );
}

export const SYSTEM_PROMPT =
  "You are an expert survey analyst. You answer questions about a survey's " +
  "aggregated results using ONLY the provided data. Never invent numbers, " +
  "never mention respondents by name, and note when the data does not contain " +
  "the answer.";

export function buildPrompt(question: string, contextText: string): string {
  return [
    "Survey data context (JSON):",
    contextText,
    "",
    "Using ONLY the data above, answer this question concisely and factually.",
    `Question: ${question}`,
  ].join("\n");
}

const TEXT_TYPES = new Set(["text", "comment", "multipletext"]);

/** Question name -> readable label, walking the SurveyJS schema. */
function textQuestionNames(schema: SurveyJsJson): Map<string, string> {
  const names = new Map<string, string>();
  const elements = (schema.pages as Array<{ elements?: unknown[] }> | undefined)
    ?.flatMap((page) => page.elements ?? [])
    .filter((element): element is Record<string, unknown> => Boolean(element));
  for (const element of elements ?? []) {
    const name = typeof element.name === "string" ? element.name : undefined;
    const type = typeof element.type === "string" ? element.type : undefined;
    const title = typeof element.title === "string" ? element.title : name;
    if (name && type && TEXT_TYPES.has(type)) names.set(name, title ?? name);
  }
  return names;
}

/**
 * Pulls a bounded set of recent free-text answers (text/comment questions
 * only) from completed responses, most recent first. Keeps the LLM payload
 * small and avoids sending structured/checkbox data the aggregates already
 * describe.
 */
export function extractRecentTextAnswers(
  schema: SurveyJsJson,
  responses: Array<{ answers?: Record<string, unknown> }>,
  maxItems = 25,
  maxChars = 200,
): Array<{ question: string; answer: string }> {
  const textQuestions = textQuestionNames(schema);
  const collected: Array<{ question: string; answer: string }> = [];
  for (const response of responses) {
    if (collected.length >= maxItems) break;
    for (const [name, value] of Object.entries(response.answers ?? {})) {
      if (collected.length >= maxItems) break;
      const label = textQuestions.get(name);
      if (!label || typeof value !== "string") continue;
      const answer = value.trim().slice(0, maxChars);
      if (answer.length === 0) continue;
      collected.push({ question: label, answer });
    }
  }
  return collected;
}
