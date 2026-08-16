# Prompt 04 — Invitations, reminders, and webhooks

Goal: add optional communications without coupling delivery success to response success.

Tasks:

1. Define invitation, reminder, completion, and webhook events with stable event IDs.
2. Add an outbox collection written in the same trusted business transaction where needed.
3. Add workers with idempotency keys, exponential backoff, max attempts, next-attempt time, delivery status, redacted errors, and dead-letter visibility.
4. Store provider credentials in Secret Manager/parameterized configuration. Never use `VITE_` values for secrets.
5. Separate transactional communication purpose from marketing consent; store source, timestamp, purpose, and opt-out state where applicable.
6. Sign outbound webhooks and document consumer replay verification.
7. Provide an admin status view and manual retry that does not create duplicate messages.

Acceptance:

- A provider outage does not roll back a completed response.
- Retried workers do not send duplicates when the provider supports idempotency.
- Logs and UI do not expose secrets or full response content.
- Consent and opt-out rules have unit/integration tests.
- Every failed job is visible and has an intentional terminal state.
