/**
 * Smoke-data provisioning for the SHARED PRODUCTION database.
 *
 * Creates a clearly-named test organization, an enabled module entitlement, a
 * trusted membership for the operator account, and one published demo survey
 * (with version, aggregates, counters, and the public projection) so the
 * deployed environment can be exercised end-to-end.
 *
 * Usage:
 *   npm run smoke:provision -- --project=survey-machine-766b8 --confirm=yes
 *
 * Guards:
 *   - Refuses emulator hosts, demo/placeholder project IDs.
 *   - Requires an explicit --confirm=yes (this writes to a shared database).
 *   - Aborts if the target organization already exists (no clobbering).
 *   - Uses Application Default Credentials only; no service-account keys.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";

interface CliOptions {
  projectId: string;
  orgId: string;
  orgName: string;
  surveyId: string;
  surveyTitle: string;
  operatorEmail: string;
  confirm: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const values: Record<string, string | undefined> = {};
  for (const arg of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match) values[match[1]] = match[2];
  }
  return {
    projectId: (values["project"] ?? "").trim(),
    orgId: (values["org"] ?? "dont-be-a-bump-smoke").trim(),
    orgName: (values["name"] ?? "Don't Be a Bump Smoke Test").trim(),
    surveyId: (values["survey"] ?? "smoke-end-of-season").trim(),
    surveyTitle: (values["survey-title"] ?? "Smoke Test End-of-Season Survey").trim(),
    operatorEmail: (values["operator-email"] ?? "joermnd@gmail.com").trim(),
    confirm: (values["confirm"] ?? "").toLowerCase() === "yes",
  };
}

function assertTrustedProjectId(projectId: string): void {
  if (!projectId) throw new Error("--project=PROJECT_ID is required.");
  if (/^demo[-_]/.test(projectId) || projectId.includes("placeholder")) {
    throw new Error(`Refusing project "${projectId}": demo/placeholder project.`);
  }
  if (projectId !== "survey-machine-766b8") {
    throw new Error(
      `Refusing project "${projectId}": smoke provisioning targets survey-machine-766b8 only.`,
    );
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  assertTrustedProjectId(options.projectId);

  if (!options.confirm) {
    throw new Error("Refusing to provision smoke data without --confirm=yes.");
  }
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error("Emulator host is set; this script refuses to run against the emulator.");
  }

  if (getApps().length === 0) initializeApp({ projectId: options.projectId });
  const db = getFirestore();
  const auth = getAuth();

  const orgRef = db.doc(`organizations/${options.orgId}`);
  if ((await orgRef.get()).exists) {
    throw new Error(
      `Organization "${options.orgId}" already exists. Refusing to overwrite smoke data.`,
    );
  }

  let operatorUid: string | null = null;
  try {
    const user = await auth.getUserByEmail(options.operatorEmail);
    operatorUid = user.uid;
  } catch {
    console.warn(
      `No Firebase Auth user found for "${options.operatorEmail}". ` +
        "Skipping the explicit membership document — the super-admin email path grants " +
        "access once that account signs in.",
    );
  }

  const surveyFile = fileURLToPath(
    new URL("../samples/end-of-season.survey.json", import.meta.url),
  );
  const schema = JSON.parse(await readFile(surveyFile, "utf8")) as Record<string, unknown>;

  const settings = {
    allowAnonymous: true,
    requireAuthentication: false,
    saveProgress: true,
    responseLimit: null,
    closesAt: null,
    locale: "en",
  };
  const branding = {
    organizationName: options.orgName,
    primaryColor: "#123a63",
    accentColor: "#f4b942",
  };
  const now = Timestamp.now();

  const createdBy = operatorUid ?? options.operatorEmail;
  const privateSurvey = {
    surveyId: options.surveyId,
    orgId: options.orgId,
    title: options.surveyTitle,
    description: "Automated smoke-test survey in the shared production database.",
    schema,
    settings,
    branding,
    status: "published",
    publishedVersion: 1,
    draftRevision: 1,
    hasUnpublishedChanges: false,
    createdBy,
    createdAt: now,
    updatedBy: createdBy,
    updatedAt: now,
    publishedBy: createdBy,
    publishedAt: now,
  };
  const publicSurvey = {
    publicSurveyId: options.surveyId,
    orgId: options.orgId,
    surveyId: options.surveyId,
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

  const batch = db.batch();
  batch.set(orgRef, {
    orgId: options.orgId,
    name: options.orgName,
    createdAt: now,
    updatedAt: now,
  });
  batch.set(db.doc(`organizations/${options.orgId}/moduleEntitlements/surveys`), {
    moduleId: "surveys",
    enabled: true,
    scope: "organization",
    updatedBy: createdBy,
    updatedAt: now,
  });
  if (operatorUid) {
    batch.set(db.doc(`organizations/${options.orgId}/members/${operatorUid}`), {
      uid: operatorUid,
      email: options.operatorEmail,
      displayName: "Platform Operator",
      roles: ["org_admin", "survey_admin", "survey_editor", "report_viewer"],
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  }
  batch.set(db.doc(`organizations/${options.orgId}/surveys/${options.surveyId}`), privateSurvey);
  batch.set(
    db.doc(`organizations/${options.orgId}/surveys/${options.surveyId}/versions/1`),
    publicSurvey,
  );
  batch.set(
    db.doc(`organizations/${options.orgId}/surveys/${options.surveyId}/aggregates/summary`),
    {
      completed: 0,
      inProgress: 0,
      totalDurationMs: 0,
      updatedAt: now,
    },
  );
  batch.set(
    db.doc(`organizations/${options.orgId}/surveys/${options.surveyId}/counters/submissions`),
    {
      completed: 0,
      updatedAt: now,
    },
  );
  batch.set(db.doc(`publicSurveys/${options.surveyId}`), publicSurvey);
  await batch.commit();

  await db.collection(`organizations/${options.orgId}/auditLogs`).add({
    actorUid: createdBy,
    action: "smoke.provisioned",
    resourceType: "organization",
    resourceId: options.orgId,
    requestId: "smoke-provision",
    details: { surveyId: options.surveyId, operatorEmail: options.operatorEmail },
    createdAt: FieldValue.serverTimestamp(),
  });

  console.log(`Smoke data provisioned for ${options.orgName} (${options.orgId}).`);
  console.log(`  Survey: ${options.surveyId} (${options.surveyTitle})`);
  console.log(`  Operator: ${operatorUid ?? "<not signed in yet>"} <${options.operatorEmail}>`);
  console.log(`  Public URL: https://dev-survey-machine.web.app/s/${options.surveyId}`);
}

main().catch((error: unknown) => {
  console.error(
    `Smoke provisioning failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
