import type { ResponseMetadata } from "@/contracts";

interface SurveySession {
  clientSubmissionId: string;
  startedAt: string;
}

function sessionKey(publicSurveyId: string): string {
  return `survey:${publicSurveyId}:session`;
}

function answersKey(publicSurveyId: string): string {
  return `survey:${publicSurveyId}:answers`;
}

export function getOrCreateSurveySession(publicSurveyId: string): SurveySession {
  const saved = localStorage.getItem(sessionKey(publicSurveyId));
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as SurveySession;
      if (parsed.clientSubmissionId && parsed.startedAt) return parsed;
    } catch {
      localStorage.removeItem(sessionKey(publicSurveyId));
    }
  }

  const session = {
    clientSubmissionId: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
  };
  localStorage.setItem(sessionKey(publicSurveyId), JSON.stringify(session));
  return session;
}

export function loadLocalAnswers(publicSurveyId: string): Record<string, unknown> {
  const saved = localStorage.getItem(answersKey(publicSurveyId));
  if (!saved) return {};
  try {
    const parsed: unknown = JSON.parse(saved);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function saveLocalAnswers(publicSurveyId: string, answers: Record<string, unknown>): void {
  localStorage.setItem(answersKey(publicSurveyId), JSON.stringify(answers));
}

export function clearLocalSurveySession(publicSurveyId: string): void {
  localStorage.removeItem(sessionKey(publicSurveyId));
  localStorage.removeItem(answersKey(publicSurveyId));
}

export function collectResponseMetadata(): ResponseMetadata {
  const params = new URLSearchParams(window.location.search);
  let referrerHost: string | undefined;
  try {
    referrerHost = document.referrer ? new URL(document.referrer).hostname : undefined;
  } catch {
    referrerHost = undefined;
  }

  // Omit absent keys entirely so the callable protocol does not serialize
  // undefined as null into a strict schema.
  const metadata: ResponseMetadata = {};
  const source = params.get("utm_source")?.slice(0, 80);
  const campaign = params.get("utm_campaign")?.slice(0, 120);
  const medium = params.get("utm_medium")?.slice(0, 80);
  if (source) metadata.source = source;
  if (campaign) metadata.campaign = campaign;
  if (medium) metadata.medium = medium;
  if (referrerHost) metadata.referrerHost = referrerHost;
  return metadata;
}
