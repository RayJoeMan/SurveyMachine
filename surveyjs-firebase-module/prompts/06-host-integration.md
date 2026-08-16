# Prompt 06 — Host PWA integration and distribution

Read `docs/MODULE-CONTRACT.md` before changing any route or data boundary.

Goal: connect the module to a host site/PWA while keeping it independently removable and secure.

Tasks:

1. Integrate only through the exported module contract, navigation metadata, stable public URLs, and explicitly versioned APIs/events.
2. Add organization branding/configuration from trusted documents; do not accept org/role/entitlement from URL parameters.
3. Add QR URL creation using the stable public survey ID and allowlisted campaign fields. QR analytics must count redirects/events without exposing response identity.
4. If adding single-use links, store only token hashes, reserve/redeem transactionally, expire them, and define whether partial responses consume the link.
5. If adding in-app targeting, evaluate trusted host user attributes/events and define recontact rules.
6. Test enabled, disabled, unavailable, embedded/standalone, and rollback states.
7. Update the module contract, changelog, and migration instructions for every external change.

Acceptance:

- Removing host navigation does not break data export/retention operations.
- No host component imports module-private folders.
- QR/single-use links cannot grant roles or cross organizations.
- Disable behavior matches the contract in both standalone and host-integrated modes.
- Contract tests catch breaking route/payload/event changes.
