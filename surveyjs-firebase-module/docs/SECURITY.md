# Security and privacy model

## Actors and threats

| Actor                    | Expected access                                          | Primary threats                                              |
| ------------------------ | -------------------------------------------------------- | ------------------------------------------------------------ |
| Anonymous respondent     | Known published survey; own submission through callables | Spam, replay, schema bypass, oversized payloads, enumeration |
| Authenticated respondent | Same plus surveys requiring sign-in                      | Claiming another user, duplicate submissions                 |
| Survey editor            | Draft definitions and summary                            | Publishing without authority, raw-response access            |
| Report viewer            | Definitions, summary, raw export                         | Excessive extraction or mishandling of PII                   |
| Survey/org admin         | Lifecycle and exports                                    | Privilege misuse, destructive changes                        |
| Backend service          | All privileged writes                                    | Secret leakage, non-idempotent retries, excessive logging    |

## Controls included

- Deny-by-default Firestore and Storage rules
- Known-ID public gets; public list denial
- Feature entitlement checked in rules and functions
- Resource-specific membership and role checks
- No direct client writes for privileged data
- Zod validation at callable boundaries
- SurveyJS server sanitization of answer names and choice values
- Visible required-question validation
- 700 KB application-level payload caps
- Opaque deterministic response IDs and idempotent transactions
- Atomic response-limit counter
- Idempotent trigger receipts
- Short-lived signed export URLs and private/no-store object metadata
- CSV formula-injection neutralization
- Allowlisted campaign metadata; no raw IP or user-agent storage
- App Check initialization and an enforcement parameter
- Audit events without answer data

## Youth-program privacy defaults

- Do not ask for player names, birth dates, medical information, or household details unless the decision genuinely requires them.
- Keep anonymous feedback separate from follow-up identity whenever practical.
- If a volunteer email is requested, state its narrow purpose and do not convert it into marketing consent.
- Never put response answers, emails, tokens, or signed export URLs in application logs.
- Establish a written retention window before production collection. The scaffold does not silently choose one.

## App Check rollout

The web app initializes reCAPTCHA Enterprise when a site key is configured. Callable functions use `ENFORCE_APP_CHECK`, defaulting to `false` so local development and first deployment are not accidentally locked out.

Production sequence:

1. Register the production web app with reCAPTCHA Enterprise.
2. Deploy the frontend with App Check initialization.
3. Observe App Check metrics for legitimate and invalid traffic.
4. Test all respondent/admin callables in staging with enforcement enabled.
5. Set `ENFORCE_APP_CHECK=true` for production and redeploy.
6. Separately enable enforcement for Firestore, Storage, and Authentication when metrics show it is safe.

App Check reduces automated abuse; it does not replace authorization, validation, quotas, or monitoring.

## File uploads

All `survey-uploads/**` access is denied. Before enabling SurveyJS file questions, implement:

- authenticated or signed anonymous upload initiation;
- per-survey content-type and byte limits;
- per-session and per-organization quotas;
- quarantine path and content/malware review decision;
- server-side attachment binding to a response;
- download authorization;
- orphan cleanup and retention;
- emulator and browser tests for spoofed file metadata.

## Security tests required for every protected resource

- unauthenticated denial;
- wrong user/organization denial;
- every permitted role;
- forbidden field or direct-write denial;
- invalid/missing/oversized input;
- disabled entitlement;
- duplicate/retry behavior;
- closed/capacity boundary;
- App Check behavior in staging.
