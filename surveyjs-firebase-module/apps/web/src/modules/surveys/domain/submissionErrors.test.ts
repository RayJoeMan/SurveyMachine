import { FirebaseError } from "firebase/app";
import { describe, expect, it } from "vitest";
import { submissionFailure } from "./submissionErrors";

function callableError(code: string): FirebaseError {
  return new FirebaseError(code, `message for ${code}`);
}

describe("submission failure mapping", () => {
  it("maps capacity reached to a permanent, non-retryable state", () => {
    const failure = submissionFailure(callableError("functions/resource-exhausted"));
    expect(failure.kind).toBe("capacity");
  });

  it("maps closed surveys to a permanent state", () => {
    expect(submissionFailure(callableError("functions/failed-precondition")).kind).toBe("closed");
  });

  it("maps permission and authentication denials together", () => {
    expect(submissionFailure(callableError("functions/permission-denied")).kind).toBe("denied");
    expect(submissionFailure(callableError("functions/unauthenticated")).kind).toBe("denied");
  });

  it("maps invalid arguments to a validation state", () => {
    expect(submissionFailure(callableError("functions/invalid-argument")).kind).toBe("validation");
  });

  it("treats unknown and non-Firebase errors as retryable", () => {
    expect(submissionFailure(callableError("functions/internal")).kind).toBe("retryable");
    expect(submissionFailure(new Error("network down")).kind).toBe("retryable");
  });
});
