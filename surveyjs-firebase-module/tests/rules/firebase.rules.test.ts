import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  collection,
  collectionGroup,
  query,
  setDoc,
  where,
} from "firebase/firestore";
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

  it("denies direct client creation of an organization (callable only)", async () => {
    await seed();
    const firestore = testEnv.authenticatedContext("outsider").firestore();
    await assertFails(
      setDoc(doc(firestore, "organizations/forged-org"), { orgId: "forged-org", name: "Forged" }),
    );
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
      getDoc(doc(adminFirestore, `organizations/${orgId}/surveys/${surveyId}/outbox/event-1`)),
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
      getDocs(query(collectionGroup(firestore, "members"), where("uid", "==", "outsider"))),
    );
    // A member document that does not carry the caller's uid must be filtered out.
    const reporterFirestore = testEnv.authenticatedContext("outsider").firestore();
    await assertFails(
      getDocs(query(collectionGroup(reporterFirestore, "members"), where("uid", "==", "reporter"))),
    );
  });
});

describe("Super-admin boundary", () => {
  function superAdminFirestore() {
    // authenticatedContext(uid, tokenOptions) lets us set the token email.
    return testEnv.authenticatedContext("superadmin", { email: "joermnd@gmail.com" }).firestore();
  }

  it("lists every organization without a membership", async () => {
    await seed();
    await assertSucceeds(getDocs(collection(superAdminFirestore(), "organizations")));
  });

  it("reads private surveys, responses, and outbox without a membership", async () => {
    await seed();
    const firestore = superAdminFirestore();
    await assertSucceeds(getDoc(doc(firestore, `organizations/${orgId}/surveys/${surveyId}`)));
    await assertSucceeds(
      getDoc(doc(firestore, `organizations/${orgId}/surveys/${surveyId}/responses/response-1`)),
    );
    await assertSucceeds(
      getDoc(doc(firestore, `organizations/${orgId}/surveys/${surveyId}/outbox/event-1`)),
    );
  });

  it("reads audit logs as a super-admin", async () => {
    await seed();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `organizations/${orgId}/auditLogs/audit-1`), {
        action: "org.export",
      });
    });
    const firestore = superAdminFirestore();
    await assertSucceeds(getDoc(doc(firestore, `organizations/${orgId}/auditLogs/audit-1`)));
  });

  it("reads a storage export as a super-admin", async () => {
    await seed();
    const path = `survey-exports/${orgId}/${surveyId}/superadmin.csv`;
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await uploadBytes(ref(context.storage(), path), new TextEncoder().encode("ok"));
    });
    const storage = testEnv
      .authenticatedContext("superadmin", { email: "joermnd@gmail.com" })
      .storage();
    await assertSucceeds(getBytes(ref(storage, path)));
  });

  it("still denies direct client writes even for a super-admin", async () => {
    await seed();
    const firestore = superAdminFirestore();
    await assertFails(
      setDoc(doc(firestore, `organizations/${orgId}/surveys/${surveyId}/responses/injected`), {
        status: "completed",
      }),
    );
    await assertFails(
      setDoc(doc(firestore, `organizations/forged-org`), { orgId: "forged-org", name: "Forged" }),
    );
  });

  it("denies super-admin visibility to a different account email", async () => {
    await seed();
    const firestore = testEnv
      .authenticatedContext("notsuper", { email: "other@gmail.com" })
      .firestore();
    await assertFails(getDoc(doc(firestore, `organizations/${orgId}/surveys/${surveyId}`)));
  });
});

describe("Platform config and invitations boundary", () => {
  it("lets any signed-in user read platform billing config", async () => {
    await seed();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "platform/billingConfig"), {
        pro: 49,
        enterprise: 199,
      });
    });
    const firestore = testEnv.authenticatedContext("outsider").firestore();
    await assertSucceeds(getDoc(doc(firestore, "platform/billingConfig")));
  });

  it("denies direct client writes to platform config", async () => {
    await seed();
    const firestore = testEnv
      .authenticatedContext("superadmin", { email: "joermnd@gmail.com" })
      .firestore();
    await assertFails(setDoc(doc(firestore, "platform/billingConfig"), { pro: 1, enterprise: 2 }));
  });

  it("lets members read org branding but denies writes", async () => {
    await seed();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `organizations/${orgId}/branding/brand`), {
        organizationName: "Test",
        primaryColor: "#123a63",
        accentColor: "#f4b942",
      });
    });
    const memberFirestore = testEnv.authenticatedContext("editor").firestore();
    await assertSucceeds(getDoc(doc(memberFirestore, `organizations/${orgId}/branding/brand`)));
    const adminFirestore = testEnv.authenticatedContext("admin").firestore();
    await assertFails(
      setDoc(doc(adminFirestore, `organizations/${orgId}/branding/brand`), {
        organizationName: "Hacked",
      }),
    );
  });

  it("lets users read only their own invitation", async () => {
    await seed();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), `organizations/${orgId}/invitations/editor@example.com`),
        {
          email: "editor@example.com",
          roles: ["survey_editor"],
          status: "pending",
        },
      );
    });
    const editorFirestore = testEnv
      .authenticatedContext("editor", { email: "editor@example.com" })
      .firestore();
    await assertSucceeds(
      getDoc(doc(editorFirestore, `organizations/${orgId}/invitations/editor@example.com`)),
    );
    const outsiderFirestore = testEnv
      .authenticatedContext("outsider", { email: "outsider@example.com" })
      .firestore();
    await assertFails(
      getDoc(doc(outsiderFirestore, `organizations/${orgId}/invitations/editor@example.com`)),
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

  it("allows org admins to upload a small image logo", async () => {
    await seed();
    const storage = testEnv.authenticatedContext("admin").storage();
    await assertSucceeds(
      uploadBytes(
        ref(storage, `public-assets/${orgId}/logo`),
        new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
        { contentType: "image/png" },
      ),
    );
  });

  it("denies non-admins and non-images from uploading a logo", async () => {
    await seed();
    const editorStorage = testEnv.authenticatedContext("editor").storage();
    await assertFails(
      uploadBytes(ref(editorStorage, `public-assets/${orgId}/logo`), new Uint8Array([1]), {
        contentType: "image/png",
      }),
    );
    const adminStorage = testEnv.authenticatedContext("admin").storage();
    await assertFails(
      uploadBytes(ref(adminStorage, `public-assets/${orgId}/logo`), new Uint8Array([1]), {
        contentType: "text/html",
      }),
    );
  });

  it("allows photo-question image uploads and denies invalid ones", async () => {
    await seed();
    const storage = testEnv.authenticatedContext("reporter").storage();

    // Valid: small image under an unguessable token.
    await assertSucceeds(
      uploadBytes(
        ref(storage, `survey-uploads/${orgId}/${surveyId}/abc123def456ghi789jkl/photo.png`),
        new Uint8Array([1, 2, 3]),
        { contentType: "image/png" },
      ),
    );

    // Denied: non-image content type.
    await assertFails(
      uploadBytes(
        ref(storage, `survey-uploads/${orgId}/${surveyId}/abc123def456ghi789jkl/file.txt`),
        new Uint8Array([1]),
        { contentType: "text/plain" },
      ),
    );

    // Denied: short / guessable token.
    await assertFails(
      uploadBytes(
        ref(storage, `survey-uploads/${orgId}/${surveyId}/reporter/photo.png`),
        new Uint8Array([1]),
        { contentType: "image/png" },
      ),
    );

    // Denied: oversized image.
    await assertFails(
      uploadBytes(
        ref(storage, `survey-uploads/${orgId}/${surveyId}/abc123def456ghi789jkl/big.png`),
        new Uint8Array(6 * 1024 * 1024),
        { contentType: "image/png" },
      ),
    );
  });
});
