# Changelog

Module contract version: `1.0.0` (see `docs/MODULE-CONTRACT.md`).

## 2026-08-16 — Buildout: Phases 0–5

### Contract changes

- `upsertSurveyV1` input now accepts an optional `expectedDraftRevision` optimistic-concurrency
  precondition. When provided and stale, the callable rejects with an `aborted` error carrying the
  current `draftRevision`. (Backwards compatible: omitting the field preserves the old behavior.)
- New collection path `organizations/{orgId}/surveys/{surveyId}/outbox` holds outbox events.
  Readable by `org_admin`/`survey_admin`; client writes denied.
- New top-level `rateLimits/` collection holds hash-only abuse-control counters. Never written or
  read by browsers.

### Added

- Trusted real-environment bootstrap: `scripts/bootstrap-org.ts` (`npm run bootstrap`). ADC-only,
  dry-run, refuses demo/placeholder project IDs, never stores service-account keys.
- Environment validation: `scripts/check-env.mjs` (`npm run check:env`) and `npm run smoke:staging`.
- Real Firebase production web configuration wired into `apps/web/.env.production`
  (project `survey-machine-766b8`) with optional Analytics initialization.
- Optimistic-concurrency draft saves (editor surfaces a clear conflict instead of last-write-wins).
- Survey editor: desktop/tablet/phone preview modes, live schema diagnostics (duplicate names,
  missing names, file questions, page/question limits), and a publish review dialog showing the
  public URL, next version, and reporting-key warning.
- File questions are rejected by both the editor diagnostics and `validateSurveyDefinition` while
  uploads remain disabled.
- Question-level aggregate distributions (`aggregates/questions`), maintained retry-safely by the
  response trigger, displayed on the report page. Free-text answers are never copied.
- Outbox foundation: `processOutboxV1` scheduled worker with exponential backoff, signed webhook
  delivery via `WEBHOOK_SIGNING_SECRET`, redacted errors, and dead-letter visibility. Email/SMS
  providers remain unregistered.
- Rate limiting (hash-only) on submit, progress save, and export callables.
- Accessible submission error states (capacity, closed, denied, validation, retryable).
- Admin home "Copy public link" action for published surveys.

### Fixed

- `test:rules` now scopes to `tests/rules/**` so `npm run verify` runs the correct suite.

### Still not complete (do not claim otherwise)

- Email/SMS invitations and reminders; webhook consumers; provider secrets.
- Scheduled retention/deletion jobs; Storage lifecycle; Firestore TTL activation.
- Single-use links, in-app targeting, QR analytics.
- Visual SurveyJS Creator (license decision required).
- Production App Check enforcement, monitoring, DNS, and deployment (rollout record in
  `docs/OPERATIONS.md`).
