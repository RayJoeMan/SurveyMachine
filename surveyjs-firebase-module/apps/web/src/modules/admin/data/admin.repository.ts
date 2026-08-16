import { collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import type {
  ExportSurveyInput,
  SurveyActionInput,
  SurveyJsJson,
  SurveySettings,
  SurveyBranding,
  UpsertSurveyInput,
} from "@/contracts";
import { db, functions } from "@/firebase/client";

export interface PrivateSurvey {
  surveyId: string;
  orgId: string;
  title: string;
  description: string;
  status: "draft" | "published" | "closed" | "archived";
  schema: SurveyJsJson;
  settings: SurveySettings;
  branding: SurveyBranding;
  publishedVersion: number;
  updatedAt?: unknown;
}

export interface SurveySummary {
  completed: number;
  inProgress: number;
  totalDurationMs: number;
  lastResponseAt?: unknown;
}

interface CallableBaseResult {
  ok: true;
  requestId: string;
}

interface SaveSurveyResult extends CallableBaseResult {
  surveyId: string;
}

interface PublishSurveyResult extends CallableBaseResult {
  publicSurveyId: string;
  version: number;
}

interface ExportSurveyResult extends CallableBaseResult {
  jobId: string;
  downloadUrl: string;
  expiresAt: string;
  responseCount: number;
}

const upsertSurveyCallable = httpsCallable<UpsertSurveyInput, SaveSurveyResult>(
  functions,
  "upsertSurveyV1",
);
const publishSurveyCallable = httpsCallable<SurveyActionInput, PublishSurveyResult>(
  functions,
  "publishSurveyV1",
);
const closeSurveyCallable = httpsCallable<SurveyActionInput, CallableBaseResult>(
  functions,
  "closeSurveyV1",
);
const exportSurveyCallable = httpsCallable<ExportSurveyInput, ExportSurveyResult>(
  functions,
  "createSurveyExportV1",
);

export async function listSurveys(orgId: string): Promise<PrivateSurvey[]> {
  const snapshot = await getDocs(
    query(collection(db, "organizations", orgId, "surveys"), orderBy("updatedAt", "desc")),
  );
  return snapshot.docs.map((item) => item.data() as PrivateSurvey);
}

export async function getSurvey(orgId: string, surveyId: string): Promise<PrivateSurvey | null> {
  const snapshot = await getDoc(doc(db, "organizations", orgId, "surveys", surveyId));
  return snapshot.exists() ? (snapshot.data() as PrivateSurvey) : null;
}

export async function getSurveySummary(orgId: string, surveyId: string): Promise<SurveySummary> {
  const snapshot = await getDoc(
    doc(db, "organizations", orgId, "surveys", surveyId, "aggregates", "summary"),
  );
  return snapshot.exists()
    ? (snapshot.data() as SurveySummary)
    : { completed: 0, inProgress: 0, totalDurationMs: 0 };
}

export async function upsertSurvey(input: UpsertSurveyInput): Promise<SaveSurveyResult> {
  return (await upsertSurveyCallable(input)).data;
}

export async function publishSurvey(input: SurveyActionInput): Promise<PublishSurveyResult> {
  return (await publishSurveyCallable(input)).data;
}

export async function closeSurvey(input: SurveyActionInput): Promise<CallableBaseResult> {
  return (await closeSurveyCallable(input)).data;
}

export async function createSurveyExport(input: ExportSurveyInput): Promise<ExportSurveyResult> {
  return (await exportSurveyCallable(input)).data;
}
