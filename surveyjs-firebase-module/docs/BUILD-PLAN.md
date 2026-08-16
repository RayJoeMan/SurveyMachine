# Dependency-ordered build plan

The initial vertical slice is scaffolded, but production readiness requires completing and verifying each module below. Prompts in `prompts/` are ready for focused VS Code agent sessions.

## Phase 0 — Foundation and environment

Outcome: reproducible development, staging, and production environments.

Acceptance criteria:

- Node/Java prerequisites and `npm ci` work on a clean checkout.
- Each environment has an explicit Firebase project alias and build configuration.
- No service-account key is committed or placed in a browser bundle.
- Emulator seed refuses to touch a non-emulator host.
- CI runs format, lint, types, units, rule tests, and build.

Prompt: `prompts/00-foundation.md`

## Phase 1 — Secure core survey transaction

Outcome: a published survey can be completed once, retried safely, and reported as completed.

Acceptance criteria:

- Public clients can get one published/closed projection but cannot enumerate surveys.
- Unknown question keys and invalid choices are discarded on the server.
- Visible required questions are enforced on the server.
- Direct browser response writes fail.
- Duplicate completion is successful but does not add a second counter/summary increment.
- Closed, disabled, expired, and full surveys reject final submissions.
- Loading, offline, retry, success, unavailable, and error states are accessible.

Prompt: `prompts/01-secure-core.md`

## Phase 2 — Administration and publishing

Outcome: authorized staff can safely draft, preview, publish, version, and close surveys.

Acceptance criteria:

- Editors can save but cannot publish, close, read raw answers, or change roles.
- Admins can publish and close.
- Each publish creates an immutable version and replaces only the public projection.
- Invalid or oversized schemas are rejected by both UI and function.
- Changing question names triggers an explicit warning because reporting keys change.
- A visual builder is added only after its license is documented.

Prompt: `prompts/02-admin-publishing.md`

## Phase 3 — Reporting, export, and retention

Outcome: staff see useful aggregates without routinely downloading raw data.

Acceptance criteria:

- Summary trigger retries cannot double-count.
- Question-level aggregates support common rating, single-choice, multiple-choice, and matrix questions.
- Free text remains private and is not copied into aggregate documents.
- Export authorization, escaping, size/page limits, expiry, audit, and failure status are tested.
- A written retention policy drives scheduled response/export/event-receipt cleanup.
- Deletion supports dry-run, audit, and legal/operational hold.

Prompt: `prompts/03-reporting-retention.md`

## Phase 4 — Invitations, reminders, and webhooks

Outcome: optional delivery workflows are consent-aware, idempotent, and observable.

Acceptance criteria:

- Transactional invitations are separated from marketing consent.
- Provider secrets use Secret Manager/parameters and never client environment variables.
- Outbox jobs have idempotency keys, attempts, next-attempt time, delivered/failed status, and admin visibility.
- Webhooks are signed and replay-resistant.
- Response completion is not rolled back because a notification fails.

Prompt: `prompts/04-workflows.md`

## Phase 5 — Abuse prevention and file uploads

Outcome: production traffic and optional attachments are protected.

Acceptance criteria:

- App Check is monitored before enforcement and verified in staging.
- Rate/volume controls protect anonymous submits, partial saves, and exports.
- File uploads use initiation, quotas, allowlists, quarantine/review decision, response binding, and cleanup.
- Spoofed MIME types, oversized files, cross-session access, and abandoned files are tested.

Prompt: `prompts/05-abuse-and-uploads.md`

## Phase 6 — Host integration and advanced distribution

Outcome: the module plugs into a host PWA without weakening boundaries.

Acceptance criteria:

- Host navigation and entitlement changes require no imports from module-private folders.
- QR codes point to stable public IDs and can optionally carry allowlisted campaign parameters.
- Single-use links store only hashed tokens and redeem transactionally.
- In-app targeting is evaluated from trusted host attributes/events.
- Disable and rollback behaviors pass in both standalone and embedded deployments.

Prompt: `prompts/06-host-integration.md`
