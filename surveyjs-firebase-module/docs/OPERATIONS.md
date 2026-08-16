# Operations runbook

## Routine checks

- Function error rate and latency for progress, submit, publish, and export
- Firestore denied-request trends and App Check invalid/missing metrics
- Submission counter versus summary `completed` count
- Export jobs stuck in `processing` or marked `failed`
- Outbox items stuck in `pending` or accumulating in `dead`
- Storage growth and expired export objects
- Firestore document/storage/function quotas and billing alerts
- Surveys approaching `responseLimit` or `closesAt`

Do not log response answers to improve diagnostics. Use `requestId`, function name, survey ID, response ID hash, job ID, and error code.

## App Check rollout record

App Check is initialized in the web client and callables enforce it only when `ENFORCE_APP_CHECK=true` (default `false`), so local development and first deployment are never accidentally locked out.

Rollout sequence (staging, then production):

1. Register the web app with reCAPTCHA Enterprise and set `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`.
2. Deploy with `ENFORCE_APP_CHECK=false` and observe App Check metrics for valid and invalid traffic.
3. Test every respondent/admin callable in staging with `ENFORCE_APP_CHECK=true`.
4. Set `ENFORCE_APP_CHECK=true`, redeploy Functions, and re-run the staging acceptance matrix.
5. Enable service-level enforcement (Firestore, Storage, Auth) separately and progressively once metrics are safe.

Emergency disable: revert `ENFORCE_APP_CHECK=false` in Functions parameters and redeploy; this is a documented, reversible parameter change and does not weaken authorization or validation.

## Abuse controls

- Rate limits (hash-only, IP-derived per caller) guard `submitSurveyResponseV1` (20 / 10 min), `saveSurveyProgressV1` (120 / 10 min), and `createSurveyExportV1` (10 / 60 min). Counter documents live under `rateLimits/` and store only hashes — never raw IP addresses. Limits are abuse damping with bounded false positives; raising them must trade off spam risk against legitimate volume.
- File-question uploads (`survey-uploads/**`) remain denied until the signed-upload, quarantine/review, quota, retention, and binding design is implemented and tested.
- Monitor rate-limit rejections as a health signal; sudden spikes may indicate an attack or a misconfigured proxy changing caller identity.

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

## Retention policy (proposed defaults — confirm before production)

The scaffold does not silently choose a policy. These values are the recommended starting point for a youth-community survey deployment and must be confirmed by the data owner before collection starts:

| Data                                     | Proposed default                                                                      | Mechanism                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Completed responses                      | Keep while the survey report is active; delete on the survey's documented end-of-life | Scheduled batch deletion (server-side, dry-run + audit) |
| Partial responses (`in_progress`)        | 90 days after last update                                                             | Scheduled batch deletion                                |
| Export objects (`survey-exports/**`)     | 7 days after generation                                                               | Storage object lifecycle or scheduled cleanup           |
| Trigger event receipts (`eventReceipts`) | 30 days                                                                               | Firestore TTL on `expiresAt`                            |
| Audit logs                               | 2 years                                                                               | Scheduled archival/deletion                             |
| Version schemas                          | Until the last matching response is deleted                                           | Never auto-delete                                       |

Implementing the scheduled jobs, the storage lifecycle rule, and the Firestore TTL is a production task (see `prompts/03-reporting-retention.md`). Until then, exports and receipts accumulate and must be reviewed manually. Deletion jobs must be exact-scope, dry-run capable, batched, audited, and must support legal/operational holds.

## Incident triage

1. Disable the affected organization or close the survey.
2. Preserve logs/audit records without copying answers into incident channels.
3. Identify whether the problem is content, authentication, rules, callable validation, provider, quota, or frontend release.
4. Roll back the narrowest affected layer.
5. Reconcile counters/summary if transactions or triggers were interrupted.
6. Re-enable only after a staging reproduction and regression test.
