# Operations runbook

## Routine checks

- Function error rate and latency for progress, submit, publish, and export
- Firestore denied-request trends and App Check invalid/missing metrics
- Submission counter versus summary `completed` count
- Export jobs stuck in `processing` or marked `failed`
- Storage growth and expired export objects
- Firestore document/storage/function quotas and billing alerts
- Surveys approaching `responseLimit` or `closesAt`

Do not log response answers to improve diagnostics. Use `requestId`, function name, survey ID, response ID hash, job ID, and error code.

## Disable collection

1. Set `organizations/{orgId}/moduleEntitlements/surveys.enabled` to `false` through a trusted admin path.
2. Confirm public reads and new submissions fail.
3. Confirm authorized staff can still read summaries and create exports.
4. Notify operators; do not delete data as part of the disable action.

## Counter reconciliation

The submission counter enforces capacity; the summary trigger serves reporting. If they diverge, do not edit from the browser. Run a trusted, dry-run reconciliation that counts completed/in-progress response documents, reports the proposed correction, then requires an explicit apply step and audit record. This utility is a planned production task, not included as an uncontrolled repair loop.

## Export handling

- Signed URLs are short-lived, but the underlying object remains until cleanup.
- Configure an approved bucket lifecycle or scheduled cleanup for `survey-exports/**`.
- Treat downloaded CSV files as sensitive local copies outside Firebase controls.
- Audit who requested each export, when, and how many rows it contained.

## Retention and deletion

Before production, choose and document:

- completed response retention;
- partial response expiration;
- export object lifetime;
- trigger-receipt TTL (the scaffold proposes 30 days);
- audit-log retention;
- legal/operational hold process;
- respondent deletion request workflow, if applicable.

Deletion must be server-side, scoped to an exact organization/survey/response, dry-run capable for bulk jobs, and audited. Deleting a survey definition must not orphan uninterpretable responses; retain matching version schemas until responses are gone.

## Incident triage

1. Disable the affected organization or close the survey.
2. Preserve logs/audit records without copying answers into incident channels.
3. Identify whether the problem is content, authentication, rules, callable validation, provider, quota, or frontend release.
4. Roll back the narrowest affected layer.
5. Reconcile counters/summary if transactions or triggers were interrupted.
6. Re-enable only after a staging reproduction and regression test.
