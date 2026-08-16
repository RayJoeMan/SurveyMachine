/**
 * Emulator-only seed for LOCAL development. Creates an organization, an admin
 * member, and one published demo survey from environment variables so nothing
 * is hardcoded to a real tenant. This script refuses to run outside the
 * emulator; production organizations must be created with `npm run bootstrap`.
 *
 * Environment overrides (all optional):
 *   SEED_ORG_ID            default "demo-org"
 *   SEED_ORG_NAME          default "Demo Organization"
 *   SEED_ADMIN_EMAIL       default "admin@example.test"
 *   SEED_ADMIN_PASSWORD    default "LocalOnly123!"
 *   SEED_SURVEY_FILE       default samples/end-of-season.survey.json
 *   SEED_SURVEY_TITLE      default "<SEED_ORG_NAME> End-of-Season Survey"
 *   SEED_PUBLIC_SURVEY_ID  default "demo-end-of-season"
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error("Refusing to seed without Firestore and Auth emulator hosts.");
}

const projectId = process.env.GCLOUD_PROJECT || "demo-survey-module";
if (getApps().length === 0) {
  initializeApp({ projectId, storageBucket: `${projectId}.firebasestorage.app` });
}

const db = getFirestore();
const auth = getAuth();

const orgId = (process.env.SEED_ORG_ID || "demo-org").trim();
const orgName = (process.env.SEED_ORG_NAME || "Demo Organization").trim();
const adminEmail = (process.env.SEED_ADMIN_EMAIL || "admin@example.test").trim();
const adminPassword = process.env.SEED_ADMIN_PASSWORD || "LocalOnly123!";
const surveyId = (process.env.SEED_PUBLIC_SURVEY_ID || "demo-end-of-season").trim();
const surveyTitle = process.env.SEED_SURVEY_TITLE?.trim() || `${orgName} End-of-Season Survey`;
const surveyFile =
  process.env.SEED_SURVEY_FILE ||
  fileURLToPath(new URL("../samples/end-of-season.survey.json", import.meta.url));

const schema = JSON.parse(await readFile(surveyFile, "utf8")) as Record<string, unknown>;

try {
  await auth.getUser(adminEmail);
} catch {
  await auth.createUser({
    uid: adminEmail,
    email: adminEmail,
    password: adminPassword,
    emailVerified: true,
    displayName: "Local Administrator",
  });
}

const settings = {
  allowAnonymous: true,
  requireAuthentication: false,
  saveProgress: true,
  responseLimit: null,
  closesAt: null,
  locale: "en",
};
const branding = {
  organizationName: orgName,
  primaryColor: "#123a63",
  accentColor: "#f4b942",
};
const now = Timestamp.now();
const batch = db.batch();

batch.set(db.doc(`organizations/${orgId}`), {
  orgId,
  name: orgName,
  createdAt: now,
  updatedAt: now,
});
batch.set(db.doc(`organizations/${orgId}/moduleEntitlements/surveys`), {
  moduleId: "surveys",
  enabled: true,
  scope: "organization",
  updatedBy: adminEmail,
  updatedAt: now,
});
batch.set(db.doc(`organizations/${orgId}/members/${adminEmail}`), {
  uid: adminEmail,
  email: adminEmail,
  displayName: "Local Administrator",
  roles: ["org_admin", "survey_admin", "survey_editor", "report_viewer"],
  active: true,
  createdAt: now,
  updatedAt: now,
});

const privateSurvey = {
  surveyId,
  orgId,
  title: surveyTitle,
  description: "Help us improve the program.",
  schema,
  settings,
  branding,
  status: "published",
  publishedVersion: 1,
  draftRevision: 1,
  hasUnpublishedChanges: false,
  createdBy: adminEmail,
  createdAt: now,
  updatedBy: adminEmail,
  updatedAt: now,
  publishedBy: adminEmail,
  publishedAt: now,
};
const publicSurvey = {
  publicSurveyId: surveyId,
  orgId,
  surveyId,
  version: 1,
  status: "published",
  title: privateSurvey.title,
  description: privateSurvey.description,
  schema,
  settings,
  branding,
  publishedAt: now,
  updatedAt: now,
};

batch.set(db.doc(`organizations/${orgId}/surveys/${surveyId}`), privateSurvey);
batch.set(db.doc(`organizations/${orgId}/surveys/${surveyId}/versions/1`), publicSurvey);
batch.set(db.doc(`organizations/${orgId}/surveys/${surveyId}/aggregates/summary`), {
  completed: 0,
  inProgress: 0,
  totalDurationMs: 0,
  updatedAt: now,
});
batch.set(db.doc(`organizations/${orgId}/surveys/${surveyId}/counters/submissions`), {
  completed: 0,
  updatedAt: now,
});
batch.set(db.doc(`publicSurveys/${surveyId}`), publicSurvey);
await batch.commit();

await db.collection(`organizations/${orgId}/auditLogs`).add({
  actorUid: adminEmail,
  action: "emulator.seeded",
  resourceType: "organization",
  resourceId: orgId,
  requestId: "local-seed",
  details: { surveyId },
  createdAt: FieldValue.serverTimestamp(),
});

console.log(`Seed complete for ${orgName} (${orgId}).`);
console.log(`Admin: ${adminEmail} / ${adminPassword}`);
console.log(`Survey: http://127.0.0.1:5173/s/${surveyId}`);
console.log(
  "Production organizations are created with `npm run bootstrap` — never with this emulator seed.",
);
