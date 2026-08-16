/**
 * Trusted organization bootstrap for REAL Firebase environments.
 *
 * Usage:
 *   npm run bootstrap -- --project=PROJECT_ID --org=ORG_ID --name="Org Name" \
 *     --admin-email=admin@example.com [--admin-uid=UID] [--roles=org_admin,survey_admin] \
 *     [--enabled=true] [--dry-run]
 *
 * Requirements:
 *   - Runs against Application Default Credentials (ADC) only. Never accept a
 *     service-account key path; the process must already be authenticated.
 *   - Refuses ambiguous or placeholder project IDs (including "demo-*").
 *   - --dry-run prints every proposed write without mutating anything.
 *   - The first admin is written as a trusted membership document. Membership
 *     and roles are NOT self-service; this script is the trusted bootstrap.
 *
 * Do NOT run this against an emulator; use `npm run seed` for emulators.
 */
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";

interface CliOptions {
  projectId: string;
  orgId: string;
  orgName: string;
  adminEmail: string;
  adminUid?: string;
  roles: string[];
  enabled: boolean;
  dryRun: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const values: Record<string, string | undefined> = {};
  for (const arg of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match) values[match[1]] = match[2];
  }

  const projectId = (values["project"] || values["projectId"] || "").trim();
  const orgId = (values["org"] || values["orgId"] || "").trim();
  const orgName = (values["name"] || "").trim();
  const adminEmail = (values["admin-email"] || "").trim();
  const adminUid = (values["admin-uid"] || "").trim() || undefined;
  const roles = (values["roles"] || "org_admin,survey_admin,survey_editor,report_viewer")
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);
  const enabled = (values["enabled"] ?? "true").toLowerCase() !== "false";
  const dryRun = (values["dry-run"] ?? "").toLowerCase() === "true";

  if (!projectId) throw new Error("--project=PROJECT_ID is required.");
  if (!orgId) throw new Error("--org=ORG_ID is required.");
  if (!orgName) throw new Error('--name="Org Name" is required.');
  if (!adminEmail) throw new Error("--admin-email is required.");
  if (roles.length === 0) throw new Error("--roles must include at least one role.");

  return { projectId, orgId, orgName, adminEmail, adminUid, roles, enabled, dryRun };
}

function assertTrustedProjectId(projectId: string): void {
  if (/^demo[-_]/.test(projectId)) {
    throw new Error(
      `Refusing project "${projectId}": demo/emulator projects are not bootstrappable.`,
    );
  }
  if (projectId.includes("your-survey") || projectId.includes("placeholder")) {
    throw new Error(`Refusing project "${projectId}": placeholder project ID.`);
  }
  if (!/^[a-z0-9-]+$/.test(projectId)) {
    throw new Error(
      `Project "${projectId}" looks invalid; expected lowercase letters, numbers, hyphens.`,
    );
  }
}

async function resolveAdminUid(
  auth: ReturnType<typeof getAuth>,
  email: string,
  requestedUid?: string,
): Promise<string> {
  if (requestedUid) return requestedUid;
  try {
    const user = await auth.getUserByEmail(email);
    return user.uid;
  } catch {
    throw new Error(
      `No existing Firebase Auth user found for "${email}". ` +
        "Create the user in Firebase Auth first, or pass --admin-uid=UID for an existing user.",
    );
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  assertTrustedProjectId(options.projectId);

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      "Emulator host is set. This script refuses to run against the emulator; use `npm run seed`.",
    );
  }
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GCLOUD_PROJECT) {
    // ADC is still resolved by the SDK when unset (e.g. gcloud auth application-default login),
    // so we only warn, not fail: the SDK will raise if no credentials exist.
    console.warn(
      "ADC: no GOOGLE_APPLICATION_CREDENTIALS set; relying on default credential resolution.",
    );
  }

  if (getApps().length === 0) initializeApp({ projectId: options.projectId });

  const db = getFirestore();
  const auth = getAuth();
  const adminUid = await resolveAdminUid(auth, options.adminEmail, options.adminUid);
  const now = Timestamp.now();

  const writes: Array<{ path: string; data: Record<string, unknown> }> = [
    {
      path: `organizations/${options.orgId}`,
      data: {
        orgId: options.orgId,
        name: options.orgName,
        createdAt: now,
        updatedAt: now,
      },
    },
    {
      path: `organizations/${options.orgId}/moduleEntitlements/surveys`,
      data: {
        moduleId: "surveys",
        enabled: options.enabled,
        scope: "organization",
        updatedBy: adminUid,
        updatedAt: now,
      },
    },
    {
      path: `organizations/${options.orgId}/members/${adminUid}`,
      data: {
        uid: adminUid,
        email: options.adminEmail,
        roles: options.roles,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    },
  ];

  console.log(`Bootstrap plan for project "${options.projectId}":`);
  for (const write of writes) {
    console.log(`  WRITE ${write.path}`);
    console.log(`    ${JSON.stringify(write.data)}`);
  }
  console.log(`  AUDIT event: "org.bootstrap"`);

  if (options.dryRun) {
    console.log("Dry run: no writes performed.");
    return;
  }

  const batch = db.batch();
  for (const write of writes) {
    batch.set(db.doc(write.path), write.data);
  }
  await batch.commit();

  await db.collection(`organizations/${options.orgId}/auditLogs`).add({
    actorUid: adminUid,
    action: "org.bootstrap",
    resourceType: "organization",
    resourceId: options.orgId,
    requestId: "trusted-bootstrap",
    details: { module: "surveys", enabled: options.enabled, roles: options.roles },
    createdAt: FieldValue.serverTimestamp(),
  });

  console.log(`Bootstrap complete for ${options.orgId} (project ${options.projectId}).`);
  console.log(`First admin membership: ${adminUid} <${options.adminEmail}>`);
  if (!options.enabled) {
    console.log(
      "Entitlement written as disabled; enable it from a trusted admin workflow when ready.",
    );
  }
}

main().catch((error: unknown) => {
  console.error(`Bootstrap failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
