# SurveyJS + Firebase Survey Module

A runnable React/TypeScript survey module built around the free SurveyJS Form Library and Firebase. It borrows proven product patterns from Formbricks—public link surveys, private definitions, conditional logic, partial responses, versioned publishing, summaries, exports, and feature entitlements—without copying Formbricks code.

## Included now

- Public, mobile-friendly SurveyJS respondent flow
- Anonymous or authenticated surveys
- Native SurveyJS branching, validation, piping, pages, and question types
- Device-local draft recovery plus optional remote partial saves
- Server-side answer sanitization and visible-required-field validation
- Idempotent submission transaction and atomic response-limit enforcement
- Draft, preview, publish, version, close, and public-projection lifecycle
- Role-gated administration and reports
- Aggregate completion metrics and controlled CSV exports
- CSV formula-injection protection
- Firebase App Check integration hook with staged enforcement
- Firestore and Storage deny-by-default rules
- Emulator-backed authorization tests
- Local seed survey and local administrator
- CI, Playwright smoke tests, VS Code tasks, agent guidance, and build prompts

## Not represented as complete

- Drag-and-drop Survey Creator UI (requires confirming the applicable SurveyJS commercial license)
- File-question uploads
- Email/SMS invitations and reminders
- Single-use links and respondent panel management
- Webhook delivery and retry queue
- Scheduled retention/deletion jobs
- Question-level precomputed charts
- Production App Check enforcement, monitoring, DNS, or deployment

These expansion points are specified in `docs/BUILD-PLAN.md` and `prompts/`.

## Local quick start

Prerequisites: Node.js 22.12+, npm 10+, and Java 21+ for the Firebase emulators.

```bash
npm install
npm run dev
```

Keep that terminal running. In a second terminal:

```bash
npm run seed
```

Then open:

- Web app: `http://127.0.0.1:5173`
- Demo survey: `http://127.0.0.1:5173/s/demo-end-of-season`
- Firebase Emulator UI: `http://127.0.0.1:4000`
- Admin: `admin@example.test` / `LocalOnly123!`

The sample password is emulator-only and must never be used in a deployed environment.

## Verification

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:rules
npm run build
```

`npm run verify` runs the complete sequence. Playwright browser smoke tests are separate because the browser binary must be installed first:

```bash
npx playwright install chromium
npm run test:e2e
```

## Production setup

1. Read `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, and `docs/DEPLOYMENT.md`.
2. Create separate Firebase projects for development, staging, and production.
3. Copy `.firebaserc.example` to `.firebaserc` and replace project IDs.
4. Copy `apps/web/.env.example` to the environment-specific build configuration and fill in the public Firebase web configuration.
5. Enable the intended Auth providers, Firestore, Storage, Functions, Hosting, and App Check.
6. Create the first organization, membership, and `moduleEntitlements/surveys` document through a trusted bootstrap script—not from the browser.
7. Deploy rules and indexes to staging, seed test-only data, and run the complete acceptance matrix.
8. Add App Check, observe metrics, and only then change `ENFORCE_APP_CHECK` to `true`.

## Repository map

```text
apps/web/                 React respondent and admin application
functions/                Firebase Functions v2 and server validation
packages/contracts/       Shared Zod request/configuration contracts
scripts/                  Emulator-only seed utility
samples/                  Portable SurveyJS schema examples
tests/rules/              Firestore and Storage authorization tests
tests/e2e/                Browser smoke tests
docs/                     Decisions, operations, security, and build plan
prompts/                  Module-by-module implementation prompts
```

The host integration entry point is `apps/web/src/modules/surveys/index.ts`. See `docs/MODULE-CONTRACT.md` before embedding or extracting the module.

See `docs/VERIFICATION.md` for the exact checks run on this generated scaffold and the two environment-dependent checks that still need to run on a normal development machine.
