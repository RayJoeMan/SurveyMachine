interface CsvResponse {
  responseId: string;
  status: string;
  surveyVersion: number;
  submittedAt?: { toDate?: () => Date } | null;
  durationMs?: number;
  anonymous?: boolean;
  answers?: Record<string, unknown>;
}

function neutralizeSpreadsheetFormula(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function csvCell(value: unknown): string {
  let text: string;
  if (value === null || value === undefined) text = "";
  else if (typeof value === "object") text = JSON.stringify(value);
  else text = String(value);
  text = neutralizeSpreadsheetFormula(text);
  return `"${text.replaceAll('"', '""')}"`;
}

export function responsesToCsv(responses: CsvResponse[]): string {
  const answerKeys = [
    ...new Set(responses.flatMap((response) => Object.keys(response.answers || {}))),
  ].sort();
  const headers = [
    "response_id",
    "status",
    "survey_version",
    "submitted_at",
    "duration_ms",
    "anonymous",
    ...answerKeys,
  ];
  const lines = [headers.map(csvCell).join(",")];

  for (const response of responses) {
    const submittedAt = response.submittedAt?.toDate?.().toISOString() || "";
    const values = [
      response.responseId,
      response.status,
      response.surveyVersion,
      submittedAt,
      response.durationMs || 0,
      response.anonymous ?? true,
      ...answerKeys.map((key) => response.answers?.[key]),
    ];
    lines.push(values.map(csvCell).join(","));
  }

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
