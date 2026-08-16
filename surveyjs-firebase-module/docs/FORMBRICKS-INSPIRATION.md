# Formbricks-inspired product guidance

Formbricks is used as a feature and workflow reference, not as a code dependency. Its useful pattern is the full feedback lifecycle: design, distribute, analyze, and act.

| Product pattern              | Scaffold treatment                                                            | Status                             |
| ---------------------------- | ----------------------------------------------------------------------------- | ---------------------------------- |
| Shareable link surveys       | Stable `/s/:publicSurveyId` route and known-ID public projection              | Implemented                        |
| Conditional logic            | SurveyJS `visibleIf`, expressions, pages, validation, and piping              | Implemented                        |
| Public vs. private data      | Separate `publicSurveys` projection and organization-owned private definition | Implemented                        |
| Partial responses            | Local draft plus debounced server progress saves                              | Implemented                        |
| Hidden/context fields        | Strictly allowlisted campaign metadata instead of arbitrary hidden writes     | Implemented                        |
| Publish lifecycle            | Draft revision, immutable versions, public projection, close state            | Implemented                        |
| Response caps                | Transactional completed-response counter                                      | Implemented                        |
| Summary and response table   | Safe summary document; raw data through role-gated export                     | Foundation implemented             |
| CSV/XLSX export              | CSV with 5,000-response job cap, short-lived URL, and audit record            | CSV implemented                    |
| Multi-language surveys       | Locale field and SurveyJS localization                                        | Foundation only                    |
| QR distribution              | Encode the stable public survey URL with a QR tool/module                     | Ready through URL contract         |
| In-app surveys and targeting | Host integration/targeting contract                                           | Future module                      |
| Single-use links             | Hashed token reservation and redemption transaction                           | Future module                      |
| Email follow-up / webhooks   | Outbox, retries, dead-letter visibility, consent rules                        | Future module                      |
| Cross-survey dashboards      | Precomputed KPIs and controlled analytics pipeline                            | Future module                      |
| Visual survey builder        | Adapter for licensed SurveyJS Creator or a purpose-built restricted editor    | Explicit license decision required |

## Best-practice choices retained

- Keep a public survey link easy to distribute by email, social media, website, or QR code.
- Version schemas at publish time so reports remain explainable.
- Treat partial completion, closed surveys, disabled modules, limits, and retry paths as product states.
- Separate raw responses from dashboards and aggregate only what staff need to see repeatedly.
- Stream or export data through trusted APIs instead of opening collections to public/client writes.

## Official references

- [Formbricks survey overview](https://formbricks.com/docs/surveys/overview)
- [Formbricks headless surveys](https://formbricks.com/docs/surveys/best-practices/headless-surveys)
- [Formbricks core license](https://formbricks.com/docs/self-hosting/advanced/license)
- [SurveyJS conditional logic](https://surveyjs.io/form-library/documentation/design-survey/conditional-logic)
- [SurveyJS server-side result sanitization guidance](https://surveyjs.io/form-library/documentation/how-to-store-survey-results)
- [SurveyJS licensing and product tiers](https://surveyjs.io/pricing)
- [Firebase Rules unit testing](https://firebase.google.com/docs/firestore/security/test-rules-emulator)
- [Firebase App Check for web](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider)
- [Firebase App Check callable enforcement](https://firebase.google.com/docs/app-check/cloud-functions)
- [Firebase Functions runtime management](https://firebase.google.com/docs/functions/manage-functions)
- [Firebase parameterized configuration and secrets](https://firebase.google.com/docs/functions/config-env)

Confirm documentation again before dependency upgrades or production deployment; APIs, runtime support, quotas, and pricing can change.
