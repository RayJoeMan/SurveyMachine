import type { SurveyJsJson } from "@/contracts";
import type {
  BuilderExtras,
  BuilderQuestion,
  BuilderQuestionType,
  ConditionOperator,
  ConditionRule,
  ParsedSurvey,
} from "./types";

let idCounter = 0;

export function createQuestionId(): string {
  idCounter += 1;
  return `q_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

export function createQuestion(type: BuilderQuestionType): BuilderQuestion {
  return {
    id: createQuestionId(),
    type,
    title: "",
    required: false,
    placeholder: "",
    options: type === "single_choice" || type === "multiple_choice" ? ["", ""] : [],
    scale: 5,
    minLabel: "",
    maxLabel: "",
    condition: null,
  };
}

/** Slugs a question title into a stable SurveyJS question name. */
export function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return slug || "question";
}

/**
 * Assigns each question a unique SurveyJS `name` derived from its title.
 * Duplicate titles get numeric suffixes so reporting keys stay unique.
 */
export function uniqueQuestionNames(questions: BuilderQuestion[]): Map<string, string> {
  const used = new Set<string>();
  const names = new Map<string, string>();
  for (const question of questions) {
    const base = slugifyTitle(question.title);
    let name = base;
    let suffix = 2;
    while (used.has(name)) {
      name = `${base}_${suffix}`;
      suffix += 1;
    }
    used.add(name);
    names.set(question.id, name);
  }
  return names;
}

function quote(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

/** Operators available for a condition that references the given question type. */
export function operatorsForQuestion(type: BuilderQuestionType): ConditionOperator[] {
  switch (type) {
    case "multiple_choice":
      return ["contains", "not_contains", "answered", "not_answered"];
    case "linear_scale":
      return ["equals", "not_equals", "greater_than", "less_than", "answered", "not_answered"];
    case "yes_no":
      return ["equals", "not_equals", "answered", "not_answered"];
    default:
      return ["equals", "not_equals", "contains", "not_contains", "answered", "not_answered"];
  }
}

/**
 * Compiles a condition rule to a SurveyJS `visibleIf` expression. Numeric
 * (linear scale) and boolean (yes/no) values are emitted raw; everything else
 * is single-quoted.
 */
export function conditionToVisibleIf(
  condition: ConditionRule,
  questionName: string,
  referencedType?: BuilderQuestionType,
): string {
  const reference = `{${questionName}}`;
  const rawValue = (): string => {
    if (referencedType === "linear_scale" || referencedType === "yes_no") {
      return condition.value;
    }
    return quote(condition.value);
  };
  switch (condition.operator) {
    case "equals":
      return `${reference} = ${rawValue()}`;
    case "not_equals":
      return `${reference} <> ${rawValue()}`;
    case "contains":
      return `${reference} contains ${rawValue()}`;
    case "not_contains":
      return `not(${reference} contains ${rawValue()})`;
    case "answered":
      return `${reference} notempty`;
    case "not_answered":
      return `${reference} empty`;
    case "greater_than":
      return `${reference} > ${condition.value}`;
    case "less_than":
      return `${reference} < ${condition.value}`;
  }
}

function nonEmptyOptions(options: string[]): string[] {
  return options.map((option) => option.trim()).filter((option) => option.length > 0);
}

function resolveVisibleIf(
  question: BuilderQuestion,
  questions: BuilderQuestion[],
  nameById: Map<string, string>,
): string | null {
  if (question.rawVisibleIf) return question.rawVisibleIf;
  const condition = question.condition;
  if (!condition) return null;
  const questionName = nameById.get(condition.questionId);
  if (!questionName) return null;
  const referenced = questions.find((item) => item.id === condition.questionId);
  return conditionToVisibleIf(condition, questionName, referenced?.type);
}

/**
 * Compiles the builder model into a full SurveyJS JSON document. The output
 * is compatible with the public renderer, the aggregate engine, AI analytics
 * and exports with no changes anywhere else.
 */
export function builderToSurveyJs(
  questions: BuilderQuestion[],
  options: { title: string; description: string; extras?: BuilderExtras },
): SurveyJsJson {
  const extras = options.extras ?? { surveyProps: {}, elements: [] };
  const nameById = uniqueQuestionNames(questions);
  const elements = questions.map((question) => {
    const base: Record<string, unknown> = {
      name: nameById.get(question.id) ?? question.id,
      title: question.title,
      isRequired: question.required,
    };
    switch (question.type) {
      case "short_answer":
        base.type = "text";
        if (question.placeholder.trim()) base.placeholder = question.placeholder.trim();
        break;
      case "long_answer":
        base.type = "comment";
        base.maxLength = 2000;
        if (question.placeholder.trim()) base.placeholder = question.placeholder.trim();
        break;
      case "date":
        base.type = "text";
        base.inputType = "date";
        break;
      case "single_choice":
        base.type = "radiogroup";
        base.choices = nonEmptyOptions(question.options);
        break;
      case "multiple_choice":
        base.type = "checkbox";
        base.choices = nonEmptyOptions(question.options);
        break;
      case "yes_no":
        base.type = "boolean";
        break;
      case "linear_scale":
        base.type = "rating";
        base.rateMin = 1;
        base.rateMax = question.scale;
        base.rateCount = question.scale;
        if (question.minLabel.trim()) base.minRateDescription = question.minLabel.trim();
        if (question.maxLabel.trim()) base.maxRateDescription = question.maxLabel.trim();
        break;
    }
    const visibleIf = resolveVisibleIf(question, questions, nameById);
    if (visibleIf) base.visibleIf = visibleIf;
    return base as unknown as SurveyJsJson;
  });

  return {
    ...extras.surveyProps,
    title: options.title,
    description: options.description,
    showProgressBar: "top",
    progressBarType: "pages",
    checkErrorsMode: "onValueChanged",
    pages: [
      {
        name: "page1",
        title: options.title,
        elements: [...elements, ...extras.elements],
      },
    ],
  };
}

interface RawElement {
  question: BuilderQuestion;
  rawVisibleIf?: string;
}

function elementToBuilder(item: Record<string, unknown>): RawElement | null {
  const type = item.type;
  let questionType: BuilderQuestionType | null = null;
  if (type === "text" && item.inputType === "date") questionType = "date";
  else if (type === "text") questionType = "short_answer";
  else if (type === "comment") questionType = "long_answer";
  else if (type === "radiogroup") questionType = "single_choice";
  else if (type === "checkbox") questionType = "multiple_choice";
  else if (type === "boolean") questionType = "yes_no";
  else if (type === "rating") questionType = "linear_scale";
  if (!questionType) return null;

  let options: string[] = [];
  if (questionType === "single_choice" || questionType === "multiple_choice") {
    options = Array.isArray(item.choices)
      ? item.choices.map((choice) => {
          if (typeof choice === "string") return choice;
          if (choice && typeof choice === "object") {
            const record = choice as Record<string, unknown>;
            return String(record.text ?? record.value ?? "");
          }
          return String(choice);
        })
      : [];
  }

  let scale: 5 | 10 = 5;
  let minLabel = "";
  let maxLabel = "";
  if (questionType === "linear_scale") {
    const rateMax = Number(item.rateMax ?? 5);
    scale = rateMax === 10 ? 10 : 5;
    minLabel = typeof item.minRateDescription === "string" ? item.minRateDescription : "";
    maxLabel = typeof item.maxRateDescription === "string" ? item.maxRateDescription : "";
  }

  const question: BuilderQuestion = {
    id: createQuestionId(),
    type: questionType,
    title: typeof item.title === "string" ? item.title : "",
    required: Boolean(item.isRequired),
    placeholder: typeof item.placeholder === "string" ? item.placeholder : "",
    options,
    scale,
    minLabel,
    maxLabel,
    condition: null,
  };

  const rawVisibleIf = typeof item.visibleIf === "string" ? item.visibleIf : undefined;
  return { question, rawVisibleIf };
}

function normalizeConditionValue(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return trimmed;
}

/**
 * A single condition value: a quoted string, a number, or a boolean literal.
 * Anchoring on exactly one literal prevents OR/AND-composed expressions from
 * being mis-parsed as a single rule (they stay raw instead).
 */
const CONDITION_LITERAL = String.raw`(?:'[^'\\]*(?:\\.[^'\\]*)*'|"[^"\\]*(?:\\.[^"\\]*)*"|true|false|-?\d+(?:\.\d+)?)`;
const CONDITION_NUMBER = String.raw`-?\d+(?:\.\d+)?`;

const CONDITION_PATTERNS: Array<{ regex: RegExp; operator: ConditionOperator }> = [
  {
    regex: new RegExp(`^not\\(\\{([^}]+)\\}\\s*contains\\s*(${CONDITION_LITERAL})\\)$`),
    operator: "not_contains",
  },
  { regex: new RegExp(`^\\{([^}]+)\\}\\s*<>\\s*(${CONDITION_LITERAL})$`), operator: "not_equals" },
  { regex: new RegExp(`^\\{([^}]+)\\}\\s*contains\\s*(${CONDITION_LITERAL})$`), operator: "contains" },
  { regex: new RegExp(`^\\{([^}]+)\\}\\s*=\\s*(${CONDITION_LITERAL})$`), operator: "equals" },
  { regex: new RegExp(`^\\{([^}]+)\\}\\s*>\\s*(${CONDITION_NUMBER})$`), operator: "greater_than" },
  { regex: new RegExp(`^\\{([^}]+)\\}\\s*<\\s*(${CONDITION_NUMBER})$`), operator: "less_than" },
  { regex: /^\{([^}]+)\}\s*notempty$/, operator: "answered" },
  { regex: /^\{([^}]+)\}\s*empty$/, operator: "not_answered" },
];

/** Best-effort parse of a single-condition `visibleIf` expression. */
export function parseVisibleIf(
  expression: string,
  nameToId: Map<string, string>,
): ConditionRule | null {
  for (const { regex, operator } of CONDITION_PATTERNS) {
    const match = expression.match(regex);
    if (!match) continue;
    const name = match[1].trim();
    const questionId = nameToId.get(name);
    if (!questionId) return null;
    if (operator === "answered" || operator === "not_answered") {
      return { questionId, operator, value: "" };
    }
    return { questionId, operator, value: normalizeConditionValue(match[2]) };
  }
  return null;
}

/** Properties the builder manages; everything else is preserved verbatim. */
const MANAGED_TOP_LEVEL = new Set([
  "title",
  "description",
  "pages",
  "elements",
  "showProgressBar",
  "progressBarType",
  "checkErrorsMode",
]);

/**
 * Parses an existing SurveyJS document into the builder model. Recognized
 * question types are editable; anything else is preserved as raw extras so
 * publishing never drops content. Complex `visibleIf` expressions are kept as
 * raw strings (still fully functional) with a warning.
 */
export function surveyJsToBuilder(schema: SurveyJsJson): ParsedSurvey {
  const record = schema as Record<string, unknown>;
  const pages = Array.isArray(record.pages) ? (record.pages as Record<string, unknown>[]) : [];
  const pageElements = pages.flatMap((page) =>
    Array.isArray(page.elements) ? (page.elements as Record<string, unknown>[]) : [],
  );
  const topElements = Array.isArray(record.elements)
    ? (record.elements as Record<string, unknown>[])
    : [];
  const allElements = [...pageElements, ...topElements];

  const questions: BuilderQuestion[] = [];
  const extrasElements: Record<string, unknown>[] = [];
  const nameToId = new Map<string, string>();
  const rawVisibleIfs = new Map<string, string>();

  for (const element of allElements) {
    if (!element || typeof element !== "object") {
      extrasElements.push(element);
      continue;
    }
    const converted = elementToBuilder(element);
    if (!converted) {
      extrasElements.push(element);
      continue;
    }
    const rawName = String(element.name ?? "");
    if (rawName) nameToId.set(rawName, converted.question.id);
    if (converted.rawVisibleIf) rawVisibleIfs.set(converted.question.id, converted.rawVisibleIf);
    questions.push(converted.question);
  }

  const warnings: string[] = [];
  for (const question of questions) {
    const raw = rawVisibleIfs.get(question.id);
    if (!raw) continue;
    const parsed = parseVisibleIf(raw, nameToId);
    if (parsed) {
      question.condition = parsed;
    } else {
      question.rawVisibleIf = raw;
      warnings.push(
        `The condition on “${question.title || question.id}” is preserved as-is because it is too complex for the visual builder.`,
      );
    }
  }

  const surveyProps: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!MANAGED_TOP_LEVEL.has(key)) surveyProps[key] = value;
  }

  return { questions, extras: { surveyProps, elements: extrasElements }, warnings };
}
