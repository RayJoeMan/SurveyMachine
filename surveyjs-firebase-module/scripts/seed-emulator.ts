import { readFile } from "node:fs/promises";
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
const orgId = "blaine-youth-lacrosse";
const surveyId = "demo-end-of-season";
const adminUid = "demo-admin";
const schema = JSON.parse(
  await readFile(new URL("../samples/blaine-end-of-season.survey.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

try {
  await auth.getUser(adminUid);
} catch {
  await auth.createUser({
    uid: adminUid,
    email: "admin@example.test",
    password: "LocalOnly123!",
    emailVerified: true,
    displayName: "Local Survey Administrator",
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
  organizationName: "Blaine Youth Lacrosse",
  primaryColor: "#123a63",
  accentColor: "#f4b942",
};
const now = Timestamp.now();
const batch = db.batch();

batch.set(db.doc(`organizations/${orgId}`), {
  orgId,
  name: "Blaine Youth Lacrosse",
  createdAt: now,
  updatedAt: now,
});
batch.set(db.doc(`organizations/${orgId}/moduleEntitlements/surveys`), {
  moduleId: "surveys",
  enabled: true,
  scope: "organization",
  updatedBy: adminUid,
  updatedAt: now,
});
batch.set(db.doc(`organizations/${orgId}/members/${adminUid}`), {
  uid: adminUid,
  email: "admin@example.test",
  displayName: "Local Survey Administrator",
  roles: ["org_admin", "survey_admin", "survey_editor", "report_viewer"],
  active: true,
  createdAt: now,
  updatedAt: now,
});

const privateSurvey = {
  surveyId,
  orgId,
  title: "Blaine Youth Lacrosse End-of-Season Survey",
  description: "Help us stabilize, grow, and improve the program.",
  schema,
  settings,
  branding,
  status: "published",
  publishedVersion: 1,
  draftRevision: 1,
  hasUnpublishedChanges: false,
  createdBy: adminUid,
  createdAt: now,
  updatedBy: adminUid,
  updatedAt: now,
  publishedBy: adminUid,
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
  actorUid: adminUid,
  action: "emulator.seeded",
  resourceType: "organization",
  resourceId: orgId,
  requestId: "local-seed",
  details: { surveyId },
  createdAt: FieldValue.serverTimestamp(),
});

console.log(`Seed complete for ${orgId}.`);
console.log("Admin: admin@example.test / LocalOnly123!");
console.log("Survey: http://127.0.0.1:5173/s/demo-end-of-season");
