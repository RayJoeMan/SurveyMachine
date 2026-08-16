# Prompt 03 — Reporting, exports, and retention

Read the data model, security model, test matrix, and operations runbook.

Goal: produce useful reporting while minimizing routine exposure of raw answers.

Tasks:

1. Define version-aware aggregation specifications for rating, Boolean, single choice, multiple choice, matrix, and completion/drop-off metrics.
2. Store only bounded aggregate keys; do not copy free-text or contact values into summary documents.
3. Make aggregation retry-safe with event receipts and add reconciliation dry-run/apply tooling.
4. Paginate exports beyond the current 5,000-row cap or explicitly split jobs. Preserve CSV injection protections, column stability, version context, job states, and audit.
5. Add a report UI with filters that query bounded aggregates rather than downloading raw responses.
6. Implement the approved retention policy with scheduled jobs, exact scopes, batched deletion, holds, dry-run, metrics, and audit.
7. Add export-object cleanup and Firestore TTL configuration for event receipts.

Acceptance:

- Trigger replays never double-count.
- Reconciliation reports drift before any mutation.
- Editors cannot read raw answers; report/admin roles can export.
- Expired data is removed according to policy without deleting needed version schemas.
- Export failures are visible and retryable without duplicating business records.
