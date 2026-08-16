import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, getDocs, collection, collectionGroup, query, setDoc, where } from "firebase/firestore";
import { getBytes, ref, uploadBytes } from "firebase/storage";
import { afterAll, afterEach, beforeAll, describe, it } from "vitest";

const projectId = "demo-survey-module";
const orgId = "test-org";
const surveyId = "test-survey";
let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
    storage: {
      host: "127.0.0.1",
      port: 9199,
      rules: readFileSync("storage.rules", "utf8"),
    },
  });
});

afterEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
});

afterAll(async () => {
  await testEnv.cleanup();
});

async function seed(enabled = true) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `organizations/${orgId}/moduleEntitlements/surveys`), {
      enabled,
    });
    await setDoc(doc(context.firestore(), `publicSurveys/${surveyId}`), {
      publicSurveyId: surveyId,
      orgId,
      surveyId,
      status: "published",
    });
    await setDoc(doc(context.firestore(), `organizations/${orgId}/surveys/${surveyId}`), {
      surveyId,
      orgId,
      title: "Private survey",
    });
    await setDoc(
      doc(context.firestore(), `organizations/${orgId}/surveys/${surveyId}/responses/response-1`),
      { status: "completed", answers: { private: true } },
    );
    await setDoc(doc(context.firestore(), `organizations/${orgId}/members/editor`), {
      roles: ["survey_editor"],
    });
    await setDoc(doc(context.firestore(), `organizations/${orgId}/members/reporter`), {
      roles: ["report_viewer"],
    });
    await setDoc(doc(context.firestore(), `organizations/${orgId}/members/outsider`), {
      roles: [],
    });
    await setDoc(doc(context.firestore(), `organizations/${orgId}/members/admin`), {
      roles: ["org_admin"],
    });
    await setDoc(
      doc(context.firestore(), `organizations/${orgId}/surveys/${surveyId}/outbox/event-1`),
      { eventId: "event-1", status: "pending", attempts: 0 },
    );
  });
}

describe("Firestore public boundary", () => {
  it("allows a known published survey when the module is enabled", async () => {
    await seed();
    await assertSucceeds(
      getDoc(doc(testEnv.unauthenticatedContext().firestore(), `publicSurveys/${surveyId}`)),
    );
  });

  it("denies public survey reads when the module is disabled", async () => {
    await seed(false);
    await assertFails(
      getDoc(doc(testEnv.unauthenticatedContext().firestore(), `publicSurveys/${surveyId}`)),
    );
  });

  it("denies public collection listing to prevent enumeration", async () => {
    await seed();
    await assertFails(
      getDocs(collection(testEnv.unauthenticatedContext().firestore(), "publicSurveys")),
    );
  });
});

describe("Firestore private boundary", () => {
  it("allows editors to read definitions but not raw responses", async () => {
    await seed();
    const firestore = testEnv.authenticatedContext("editor").firestore();
    await assertSucceeds(getDoc(doc(firestore, `organizations/${orgId}/surveys/${surveyId}`)));
    await assertFails(
      getDoc(doc(firestore, `organizations/${orgId}/surveys/${surveyId}/responses/response-1`)),
    );
  });

  it("allows report viewers to read raw responses", async () => {
    await seed();
    const firestore = testEnv.authenticatedContext("reporter").firestore();
    await assertSucceeds(
      getDoc(doc(firestore, `organizations/${orgId}/surveys/${surveyId}/responses/response-1`)),
    );
  });

  it("denies every direct client response write", async () => {
    await seed();
    const firestore = testEnv.authenticatedContext("reporter").firestore();
    await assertFails(
      setDoc(doc(firestore, `organizations/${orgId}/surveys/${surveyId}/responses/injected`), {
        status: "completed",
      }),
    );
  });

  it("denies direct client deletion of a survey (server-side delete only)", async () => {
    await seed();
    const firestore = testEnv.authenticatedContext("admin").firestore();
    await assertFails(deleteDoc(doc(firestore, `organizations/${orgId}/surveys/${surveyId}`)));
  });

  it("denies users without a permitted role", async () => {
    await seed();
    const firestore = testEnv.authenticatedContext("outsider").firestore();
    await assertFails(getDoc(doc(firestore, `organizations/${orgId}/surveys/${surveyId}`)));
  });

  it("allows admins to see outbox events but editors cannot", async () => {
    await seed();
    const adminFirestore = testEnv.authenticatedContext("admin").firestore();
    await assertSucceeds(
      getDoc(
        doc(adminFirestore, `organizations/${orgId}/surveys/${surveyId}/outbox/event-1`),
      ),
    );
    const editorFirestore = testEnv.authenticatedContext("editor").firestore();
    await assertFails(
      getDoc(doc(editorFirestore, `organizations/${orgId}/surveys/${surveyId}/outbox/event-1`)),
    );
  });

  it("lets users list only their own memberships across organizations", async () => {
    await seed();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `organizations/other-org/members/outsider`), {
        uid: "outsider",
        roles: ["survey_editor"],
      });
    });
    const firestore = testEnv.authenticatedContext("outsider").firestore();
    await assertSucceeds(
      getDocs(
        query(
          collectionGroup(firestore, "members"),
          where("uid", "==", "outsider"),
        ),
      ),
    );
    // A member document that does not carry the caller's uid must be filtered out.
    const reporterFirestore = testEnv.authenticatedContext("outsider").firestore();
    await assertFails(
      getDocs(
        query(
          collectionGroup(reporterFirestore, "members"),
          where("uid", "==", "reporter"),
        ),
      ),
    );
  });
});

describe("Storage boundary", () => {
  it("denies direct client writes to export paths", async () => {
    await seed();
    const storage = testEnv.authenticatedContext("reporter").storage();
    await assertFails(
      uploadBytes(
        ref(storage, `survey-exports/${orgId}/${surveyId}/forged.csv`),
        new Uint8Array([1, 2, 3]),
      ),
    );
  });

  it("allows report viewers to read a server-created export", async () => {
    await seed();
    const path = `survey-exports/${orgId}/${surveyId}/valid.csv`;
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await uploadBytes(ref(context.storage(), path), new TextEncoder().encode("ok"));
    });
    const storage = testEnv.authenticatedContext("reporter").storage();
    await assertSucceeds(getBytes(ref(storage, path)));
  });

  it("denies survey uploads until the upload workflow is implemented", async () => {
    await seed();
    const storage = testEnv.authenticatedContext("reporter").storage();
    await assertFails(
      uploadBytes(
        ref(storage, `survey-uploads/${orgId}/${surveyId}/reporter/file.txt`),
        new Uint8Array([1]),
      ),
    );
  });
});
