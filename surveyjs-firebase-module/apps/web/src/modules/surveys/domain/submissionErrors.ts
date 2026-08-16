import { FirebaseError } from "firebase/app";

export type SubmissionErrorKind =
  "offline" | "capacity" | "closed" | "denied" | "validation" | "retryable";

export interface SubmissionFailure {
  kind: SubmissionErrorKind;
  message: string;
}

/**
 * Maps a server/callable submission failure to a stable, user-facing state.
 * Permanent failures (capacity, closed, denied) must not present a retry loop;
 * only retryable/validation/offline failures offer one.
 */
export function submissionFailure(error: unknown): SubmissionFailure {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "functions/resource-exhausted":
        return {
          kind: "capacity",
          message:
            "This survey has reached its response limit, so no more responses can be accepted.",
        };
      case "functions/failed-precondition":
        return {
          kind: "closed",
          message: "This survey is no longer accepting responses.",
        };
      case "functions/permission-denied":
      case "functions/unauthenticated":
        return {
          kind: "denied",
          message: "You do not have permission to submit to this survey right now.",
        };
      case "functions/invalid-argument":
        return {
          kind: "validation",
          message: "Some answers could not be validated. Please review and try again.",
        };
      default:
        break;
    }
  }
  return {
    kind: "retryable",
    message:
      "We could not submit your response. Your answers remain saved on this device. Please retry.",
  };
}
