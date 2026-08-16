# Agent instructions

This repository is a secure survey module, not a generic form demo.

- Read `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, and `docs/MODULE-CONTRACT.md` before changing boundaries.
- Preserve the public projection pattern: public clients read `publicSurveys`; private definitions and responses remain under an organization.
- Never add direct client writes for responses, publishing, roles, exports, counters, or audit records.
- Validate callable inputs with the shared Zod contracts and validate/sanitize answers again with SurveyJS on the server.
- Add or update Firestore/Storage emulator tests for every authorization change.
- Treat anonymous youth-program surveys as sensitive even when names are not requested.
- Do not add SurveyJS Creator packages without confirming the applicable commercial license.
- Mark placeholders explicitly. Do not claim external email, SMS, App Check enforcement, scheduled retention, or production deployment is complete until configured and tested.
- Run `npm run verify` before handoff. If a check cannot run, report it exactly.
