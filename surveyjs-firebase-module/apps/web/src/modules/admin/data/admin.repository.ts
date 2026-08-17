import { collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { FirebaseError } from "firebase/app";
import type {
  CreateOrganizationInput,
  ExportOrganizationDataInput,
  ExportSurveyInput,
  OrgBranding,
  SurveyActionInput,
  SurveyJsJson,
  SurveySettings,
  SurveyBranding,
  UpdateOrganizationInput,
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
  draftRevision: number;
  updatedAt?: unknown;
}

/** True when the callable rejected a save because the draft changed underneath us. */
export function isDraftConflictError(error: unknown): boolean {
  return error instanceof FirebaseError && error.code === "functions/aborted";
}

export interface SurveySummary {
  completed: number;
  inProgress: number;
  totalDurationMs: number;
  lastResponseAt?: unknown;
}

export interface QuestionAggregate {
  questionType?: string;
  total?: number;
  counts?: Record<string, number>;
}

export type QuestionAggregates = Record<string, QuestionAggregate>;

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

interface DeleteSurveyResult extends CallableBaseResult {
  deleted: boolean;
}

interface OrgExportResult extends CallableBaseResult {
  downloadUrl: string;
  expiresAt: string;
  surveyCount: number;
  memberCount: number;
}

interface CreateOrganizationResult extends CallableBaseResult {
  orgId: string;
  created: boolean;
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
const deleteSurveyCallable = httpsCallable<SurveyActionInput, DeleteSurveyResult>(
  functions,
  "deleteSurveyV1",
);
const orgExportCallable = httpsCallable<ExportOrganizationDataInput, OrgExportResult>(
  functions,
  "exportOrganizationDataV1",
);
const createOrganizationCallable = httpsCallable<CreateOrganizationInput, CreateOrganizationResult>(
  functions,
  "createOrganizationV1",
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

export async function getSurveyQuestionAggregates(
  orgId: string,
  surveyId: string,
): Promise<QuestionAggregates> {
  const snapshot = await getDoc(
    doc(db, "organizations", orgId, "surveys", surveyId, "aggregates", "questions"),
  );
  if (!snapshot.exists()) return {};
  const questions: QuestionAggregates = {};
  for (const [key, value] of Object.entries(snapshot.data() ?? {})) {
    if (key === "updatedAt") continue;
    questions[key] = value as QuestionAggregate;
  }
  return questions;
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

export async function deleteSurvey(input: SurveyActionInput): Promise<DeleteSurveyResult> {
  return (await deleteSurveyCallable(input)).data;
}

export async function exportOrganizationData(
  input: ExportOrganizationDataInput,
): Promise<OrgExportResult> {
  return (await orgExportCallable(input)).data;
}

export async function createOrganization(
  input: CreateOrganizationInput,
): Promise<CreateOrganizationResult> {
  return (await createOrganizationCallable(input)).data;
}

// ---------------------------------------------------------------------------
// Organization settings + branding
// ---------------------------------------------------------------------------

export async function updateOrganization(input: UpdateOrganizationInput): Promise<string> {
  const callable = httpsCallable<
    UpdateOrganizationInput,
    { ok: true; requestId: string; name: string }
  >(functions, "updateOrganizationV1");
  const result = await callable(input);
  return result.data.name;
}

export async function loadOrgBranding(orgId: string): Promise<OrgBranding | null> {
  const snapshot = await getDoc(doc(db, "organizations", orgId, "branding", "brand"));
  if (!snapshot.exists()) return null;
  return snapshot.data() as OrgBranding;
}
