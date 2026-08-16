# Test matrix

## Automated foundation

| Layer           | Command                  | Included coverage                                                              |
| --------------- | ------------------------ | ------------------------------------------------------------------------------ |
| Formatting      | `npm run format:check`   | All source/config/docs                                                         |
| Static analysis | `npm run lint`           | TypeScript/React conventions and hook safety                                   |
| Types           | `npm run typecheck`      | Contracts, web, and functions                                                  |
| Web units       | `npm run test:unit`      | Local draft/session behavior and entry routes                                  |
| Function units  | `npm run test:functions` | Survey sanitization, required answers, IDs, duration, CSV escaping/injection   |
| Rules           | `npm run test:rules`     | Public/disabled/list boundaries, roles, direct writes, Storage exports/uploads |
| Build           | `npm run build`          | Vite production bundle and Functions bundle                                    |
| Browser smoke   | `npm run test:e2e`       | Desktop/mobile entry and unknown-route recovery                                |

## Required production acceptance

| Flow                        | Anonymous | Auth respondent |              Editor |       Report viewer |        Survey admin |                      Org admin |
| --------------------------- | --------: | --------------: | ------------------: | ------------------: | ------------------: | -----------------------------: |
| Get published survey by ID  |     Allow |           Allow |               Allow |               Allow |               Allow |                          Allow |
| List public surveys         |      Deny |            Deny |                Deny |                Deny |                Deny |                           Deny |
| Submit anonymous survey     |     Allow |           Allow |                 N/A |                 N/A |                 N/A |                            N/A |
| Submit auth-required survey |      Deny |           Allow | Allow as respondent | Allow as respondent | Allow as respondent |            Allow as respondent |
| Save draft definition       |      Deny |            Deny |               Allow |                Deny |               Allow |                          Allow |
| Publish/close               |      Deny |            Deny |                Deny |                Deny |               Allow |                          Allow |
| Read summary                |      Deny |            Deny |               Allow |               Allow |               Allow |                          Allow |
| Read/export raw answers     |      Deny |            Deny |                Deny |               Allow |               Allow |                          Allow |
| Change membership/role      |      Deny |            Deny |                Deny |                Deny |                Deny | Trusted org-admin backend only |

## State coverage checklist

- Loading, empty, validation error, denied, offline, duplicate/retry, success, disabled, closed, expired, capacity reached, and unexpected failure
- Every editor input and button, including invalid JSON, oversized schema, publish without role, and close confirmation
- Phone 320/375 px, tablet 768 px, desktop 1280+ px
- Keyboard-only completion, visible focus, labels, focus after validation, status announcements, contrast, reduced motion
- Two tabs editing the same draft; stale publish decision documented
- Function retry and trigger retry
- Export failure after job creation; job status visible
- App Check valid, missing, invalid, and debug-provider behavior in staging

## Before every release

1. Run `npm run verify` from a clean install.
2. Run Playwright after installing Chromium.
3. Exercise the full seeded survey through the emulators.
4. Test every role with distinct accounts.
5. Inspect browser console, emulator/function logs, and failed network calls.
6. Deploy to staging and repeat the critical respondent/admin flows against real Firebase services.
7. Confirm indexes, rules, Functions parameters, Auth domains/providers, App Check metrics, and Storage bucket policy.
