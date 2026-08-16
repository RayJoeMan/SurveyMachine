# Assumptions and open decisions

## Assumptions used in this scaffold

- The module is a commercialization-ready, multi-tenant product: no organization is pre-seeded, and every tenant organization is created from a trusted shell (`npm run bootstrap`), never from the browser or the emulator seed.
- Initial volume is community/small-business scale per tenant, not millions of responses per hour.
- Most surveys can be anonymous; staff administration requires Firebase Authentication.
- Survey definitions can initially be maintained through reviewed SurveyJS JSON plus live preview.
- Raw answers should be less accessible than aggregate reports.
- Firebase project region is selected before data creation and kept close to primary users.
- English is the first locale, with schema-level localization added later.
- QR codes will encode stable public survey URLs; QR generation/tracking is a separate module.

## Decisions required before production

1. Which organization(s) and Firebase project own the production data?
2. Is anonymous participation allowed for each survey class?
3. What information is truly necessary, especially for youth/player surveys?
4. What are response, partial-response, export, and audit retention periods?
5. Which staff receive each role, and who can grant/revoke roles?
6. Is SurveyJS Creator licensing worthwhile, or is reviewed JSON sufficient?
7. Which reporting metrics need precomputed question-level aggregates?
8. Are email/SMS invitations needed, and which provider/consent model applies?
9. Are file questions needed enough to justify the upload safety workflow?
10. Should this remain standalone or move into a specific customer PWA once the broader reporting platform exists?
11. Who can create organizations, and what is the commercial onboarding/entitlement process for a new tenant?
