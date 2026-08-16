# Prompt 00 — Foundation and environments

Work inside this repository. Read `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/MODULE-CONTRACT.md`, `docs/SECURITY.md`, and `docs/DEPLOYMENT.md` first.

Goal: make development, staging, and production configuration reproducible without weakening security.

Tasks:

1. Inspect the existing package versions, Firebase configuration, CI, and uncommitted work.
2. Verify the current supported Firebase Node runtime and SDK guidance against official Firebase documentation.
3. Keep Node 22, npm workspaces, Vite, Functions v2, and the independent Firebase codebase unless a concrete incompatibility is found.
4. Add a trusted bootstrap script for a real environment that accepts exact organization/admin inputs, uses Application Default Credentials, refuses ambiguous project IDs, supports dry-run, and never stores a service-account key.
5. Add environment validation and a staging smoke command.
6. Ensure emulator seed code cannot reach production.
7. Update CI caching and checks without suppressing failures.

Acceptance:

- A clean checkout can run install, emulators, seed, tests, and build using documented commands.
- Missing production configuration fails before deployment.
- The bootstrap prints exact proposed writes in dry-run and writes only after an explicit flag.
- No secrets are present in browser output, repository, logs, or test fixtures.
- `npm run verify` passes.

Do not deploy or create external resources unless explicitly authorized.
