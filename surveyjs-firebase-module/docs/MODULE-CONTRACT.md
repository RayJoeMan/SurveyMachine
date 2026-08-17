# Survey module contract

## Identity

- Module ID: `surveys`
- Contract version: `1.0.0`
- Host entry point: `apps/web/src/modules/surveys/index.ts`
- Public route: `/s/:publicSurveyId`
- Admin route root: `/admin`
- Completion route: `/thanks/:publicSurveyId`

## Host responsibilities

- Provide a link or navigation entry to the standalone module.
- Pass campaign attribution only through the allowlisted `utm_source`, `utm_medium`, and `utm_campaign` parameters.
- Do not pass roles, organization IDs, user IDs, survey status, or entitlements in query parameters.
- If embedding in an iframe, explicitly decide allowed parent origins and add a tested Content Security Policy. The default scaffold does not enable iframe embedding.
- Treat exported response data as sensitive and apply the host organization’s access and retention policy.

## Module responsibilities

- Resolve a known public survey ID without allowing collection enumeration.
- Enforce the organization entitlement in both Firestore Rules and trusted functions.
- Keep private definitions and responses under the owning organization.
- Validate every callable payload and every SurveyJS response on the server.
- Preserve publish-time versions so old responses remain interpretable.
- Emit audit records for draft saves, publishing, closing, and exports.

## Authentication and roles

| Role            | Definitions      | Publish/close | Summary | Raw response/export | Membership/audit                 |
| --------------- | ---------------- | ------------- | ------- | ------------------- | -------------------------------- |
| `survey_editor` | Read/save drafts | No            | Read    | No                  | No                               |
| `report_viewer` | Read             | No            | Read    | Read/export         | No                               |
| `survey_admin`  | Read/save        | Yes           | Read    | Read/export         | No                               |
| `org_admin`     | Read/save        | Yes           | Read    | Read/export         | Membership reads and audit reads |

Membership and roles are trusted Firestore documents created by an administrative bootstrap or backend workflow. They are not self-service fields.

## Entitlement behavior

Path: `organizations/{orgId}/moduleEntitlements/surveys`

Required field: `enabled: boolean`

When disabled:

- published survey projections cannot be read;
- partial-save and final-submit functions reject requests;
- new drafts and publishing reject requests;
- private definitions, summaries, and existing responses remain readable by authorized staff;
- close and export remain available so administrators can stop collection and retrieve existing data;
- no data is deleted automatically.

## Owned data and storage

- Firestore: `publicSurveys`, `organizations/{orgId}/surveys`, nested versions/responses/aggregates/counters/eventReceipts/exportJobs, memberships, entitlement, audit logs
- Storage: `survey-exports/{orgId}/{surveyId}/{fileName}`
- Reserved/denied until implemented: `survey-uploads/**`

## Callables

| Callable                 | Caller                 | Purpose                                                      |
| ------------------------ | ---------------------- | ------------------------------------------------------------ |
| `saveSurveyProgressV1`   | Public/auth respondent | Sanitize and save an in-progress response                    |
| `submitSurveyResponseV1` | Public/auth respondent | Validate and atomically complete a response                  |
| `upsertSurveyV1`         | Editor/admin           | Save a private draft                                         |
| `publishSurveyV1`        | Survey/org admin       | Version and publish a public projection                      |
| `closeSurveyV1`          | Survey/org admin       | Stop new responses while preserving a readable closed screen |
| `createSurveyExportV1`   | Report/admin           | Generate a short-lived CSV export                            |

## Disable, uninstall, and rollback

Disable first. Export data. Confirm retention/deletion obligations. Remove navigation. Keep functions/rules available until data export and deletion are complete. Uninstalling the frontend must not imply data deletion. See `docs/OPERATIONS.md`.

## Billing (Stripe)

- `createCheckoutSessionV1` (org_admin) — starts a live Stripe Checkout subscription session for a paid plan. Products/prices are created lazily and idempotently (product metadata `sm_plan`); the entitlement is granted ONLY by the verified webhook.
- `createBillingPortalSessionV1` (org_admin) — opens Stripe's billing portal (invoices, payment method, cancellation).
- `stripeWebhookV1` (HTTPS endpoint) — verifies the `stripe-signature` against `STRIPE_WEBHOOK_SECRET`, then reconciles the org `billing/subscription` document and the survey module entitlement from: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. Idempotent via per-event receipts in `billingEvents/{eventId}`; never trusts a redirect alone.
- Billing document: `organizations/{orgId}/billing/subscription` (plan, status, stripeCustomerId, stripeSubscriptionId, currentPeriodEnd). Firestore rule: read by `org_admin`/super-admin only; client writes denied.
- Plans: `free` / `pro` ($49/mo) / `enterprise` ($199/mo), defined in `BILLING_PLAN_DETAILS` in the contracts package.
- Configuration (functions environment, gitignored `functions/.env`): `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`.
