# Prompt 01 — Secure respondent transaction

Read the architecture, data model, security model, and test matrix. Preserve the public-projection pattern and callable-only response writes.

Goal: finish and prove the smallest complete respondent path.

Tasks:

1. Audit the SurveyJS client and server behavior for visible required questions, invalid choices, matrices, dynamic panels, calculated values, and conditional pages.
2. Add unit fixtures covering each supported question family and explicit rejection behavior for unsupported/unsafe fields.
3. Add emulator/integration tests for anonymous/auth-required surveys, partial-to-complete transition, duplicate completion, closed date, disabled entitlement, and response capacity races.
4. Add structured, privacy-safe error codes and correlation IDs. Do not log answers.
5. Ensure local draft recovery behaves correctly after network failure, successful completion, retry, and a new response.
6. Add accessible UI for capacity reached, closed date, permission denied, invalid server response, and retry.
7. Test two simultaneous final submissions sharing a client submission ID and two different IDs competing for the last response slot.

Acceptance:

- Unknown keys/invalid choices cannot reach Firestore.
- Visible required questions are enforced server-side.
- One logical response increments capacity and summary once under retry/concurrency.
- Every state is keyboard accessible and announced appropriately.
- Direct client writes remain denied.
- `npm run verify` and targeted browser tests pass.
