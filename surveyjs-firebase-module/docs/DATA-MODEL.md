# Firestore data model

The schema is designed from query and authorization boundaries. Server timestamps are authoritative; client dates are retained only as explicitly named client fields.

| Path                                               | Purpose / key fields                                                                             | Writer                  | Reader                              | Index / retention                        | Sensitivity                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------- | ----------------------------------- | ---------------------------------------- | -------------------------- |
| `organizations/{orgId}`                            | Organization identity                                                                            | Bootstrap backend       | Members                             | Keep while tenant exists                 | Internal                   |
| `organizations/{orgId}/members/{uid}`              | `roles`, `active`, display metadata                                                              | Bootstrap/admin backend | Self; org admin                     | Remove when access ends                  | Sensitive access control   |
| `organizations/{orgId}/moduleEntitlements/surveys` | `enabled`, scope, audit metadata                                                                 | Trusted backend         | Members; rules/functions internally | Keep audit history separately            | Internal control           |
| `organizations/{orgId}/surveys/{surveyId}`         | Private draft, settings, branding, status, revision, active published version                    | Admin functions         | Survey roles                        | Order by `updatedAt`                     | Internal                   |
| `.../versions/{version}`                           | Immutable publish-time snapshot                                                                  | Publish function        | Survey roles                        | Keep while matching responses exist      | Internal                   |
| `publicSurveys/{publicSurveyId}`                   | Published/closed projection                                                                      | Publish/close functions | Known-ID public get only            | Never list publicly                      | Public by design           |
| `.../responses/{responseId}`                       | Status, sanitized answers, version, pseudonymous respondent/session fields, timestamps, duration | Respondent functions    | Report/admin roles                  | Status + submitted time; policy required | Sensitive; may include PII |
| `.../counters/submissions`                         | Atomic completed count for response limit                                                        | Submit function         | Backend only                        | Keep with survey                         | Internal integrity         |
| `.../aggregates/summary`                           | Completion/progress counts, total duration                                                       | Idempotent trigger      | Survey roles                        | One document                             | Aggregated                 |
| `.../eventReceipts/{hash}`                         | Processed trigger event ID and expiry                                                            | Trigger                 | Backend only                        | Configure Firestore TTL on `expiresAt`   | Operational                |
| `.../exportJobs/{jobId}`                           | Requester, status, count, path, expiry                                                           | Export function         | Requester/admin                     | Delete after operational window          | Sensitive operational      |
| `organizations/{orgId}/auditLogs/{id}`             | Actor, action, resource, request ID, non-PII details                                             | Functions               | Org admin                           | Choose policy; append-only               | Sensitive operational      |

## Query inventory

- List private surveys for an organization ordered by `updatedAt desc`.
- List completed responses ordered by `submittedAt desc` for exports, capped at 5,000 per job.
- List export jobs by requester and `createdAt desc` for a future job-status UI.
- Get one known public survey ID; public listing is intentionally denied.
- Get one summary aggregate document.

The included `firestore.indexes.json` supports these queries.

## Response identity and retries

The browser creates a random UUID and retains it with the local draft. The server hashes `{publicSurveyId}:{uuid}` into the Firestore document ID. Repeating the same final submission returns success with `duplicate: true`; it does not increment the counter again.

## Version interpretation

Each response stores `surveyVersion`. Publishing copies the schema into `versions/{version}` and updates only the public projection. Reports must interpret an answer using the response’s stored version, not whichever draft is currently open.

## Size and contention

- Survey schemas and responses are capped at 700 KB before Firestore writes.
- Answers remain in one response document for atomic reads and exports. If a use case approaches the Firestore document limit, redesign before increasing the application cap.
- One submission counter can become a contention point at very high volume. For community surveys this favors correct response limits. High-throughput campaigns should adopt distributed counters plus a separate quota reservation design.
