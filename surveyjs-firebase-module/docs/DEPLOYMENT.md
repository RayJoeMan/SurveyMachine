# Deployment and rollback

## Environment strategy

Use separate Firebase projects for `dev`, `stage`, and `prod`. Do not point a local build at production. Do not reuse the production Storage bucket or response database for testing.

## Initial environment setup

1. Create the Firebase project and web app.
2. Enable Firestore in the chosen production region.
3. Enable Storage, Hosting, Cloud Functions, and required Google Cloud APIs.
4. Enable Email/Password for emulator parity and the intended production provider (commonly Google); restrict authorized domains.
5. Copy `.firebaserc.example` to `.firebaserc` and set real aliases.
6. Provide the public Firebase web values at build time from `apps/web/.env.example`.
7. Configure Functions parameters:
   - `ENFORCE_APP_CHECK=false` for first staging deploy
   - `EXPORT_URL_TTL_MINUTES=15` or approved value
8. Deploy rules and indexes first to staging.
9. Bootstrap the organization, entitlement, and first admin membership from a trusted environment using Application Default Credentials. Do not use `scripts/seed-emulator.ts` against production.
10. Deploy Functions and Hosting, then run the full staging acceptance suite.

## Deploy commands

```bash
npm ci
npm run verify
firebase use stage
firebase deploy --only firestore:rules,firestore:indexes,storage
firebase deploy --only functions:survey-module
firebase deploy --only hosting
```

Deploy to production only from a known commit after staging sign-off. Consider separate deployment jobs and manual approval for rules/functions versus Hosting.

## App Check change

After staging and production metrics show valid traffic is attested, set enforcement to true and redeploy Functions. Enable service-level enforcement separately and progressively. Keep a documented emergency reversal command/parameter change.

## Rollback

- Frontend: redeploy the last known-good Hosting release.
- Function logic: redeploy the prior commit. Never delete an old event handler until its replacement has proven idempotent and traffic has moved.
- Rules: deploy the prior reviewed rules file. A rollback must not reopen broad reads/writes.
- Survey content: publish a corrected version; do not mutate an immutable version document.
- Incident stop: set the organization entitlement to `enabled: false` from a trusted admin workflow. This blocks collection while retaining authorized reporting/export.

## Deployment checklist

- [ ] Clean `npm ci` and `npm run verify`
- [ ] Correct project alias and billing/quotas reviewed
- [ ] No secrets or service-account JSON in repository/build output
- [ ] Rules/index diff reviewed
- [ ] Required Functions parameters and secrets present
- [ ] Auth providers and authorized domains correct
- [ ] App Check mode intentional
- [ ] Staging respondent/admin tests passed
- [ ] Monitoring and budget alerts configured
- [ ] Rollback commit and operator identified
- [ ] Post-deploy smoke test and logs reviewed
