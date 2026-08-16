# Scaffold verification record

Generated and checked on 2026-08-12.

## Passed

- `npm install` with a generated lockfile
- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- Web unit tests: 2 files, 3 tests
- Functions unit tests: 2 files, 6 tests
- `npm run build`
  - Vite production build completed with route-level code splitting
  - Cloud Functions CJS bundle completed for Node.js 22

## Included but not executable in the generation workspace

- `npm run test:rules`: the official Firestore emulator binary was not present, and its Google-hosted download endpoint was outside the workspace network allowlist. The Firestore/Storage test suite is included and must be run on a normal network before deployment.
- `npm run test:e2e`: Playwright started the Vite server and discovered all four desktop/mobile tests, but the generation workspace did not contain a Chromium binary. Run `npx playwright install chromium` and then `npm run test:e2e`.

These are environment blockers, not passing checks. Production deployment is not approved until both run successfully.

## Dependency audit note

`npm audit --omit=dev` reported no high or critical findings and seven moderate findings in transitive Google Cloud Storage/request dependencies pulled by the current Firebase Admin/Functions packages. The chain includes an older transitive `uuid` advisory. npm's suggested automatic resolution is a major downgrade of Firebase packages and was not applied. Re-run the audit before production and adopt an upstream Firebase/Google Cloud release that resolves the chain; do not force incompatible overrides without integration testing.
