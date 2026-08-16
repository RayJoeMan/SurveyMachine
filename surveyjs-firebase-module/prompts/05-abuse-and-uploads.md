# Prompt 05 — Abuse controls and file questions

Goal: enable production App Check and, only if approved, safe file-question uploads.

Tasks:

1. Add staging App Check with the debug provider only in local/test environments and reCAPTCHA Enterprise in production.
2. Observe valid/invalid metrics before enforcement; create a rollout and emergency-disable record.
3. Add bounded per-survey/session/IP-derived server controls without persisting raw IP addresses. Document privacy and false-positive tradeoffs.
4. Design upload initiation through a trusted callable that verifies survey, session, question, status, content allowlist, byte limit, and quota.
5. Upload to quarantine with opaque server-generated paths. Bind only approved objects to a response.
6. Choose and implement content/malware review appropriate to the risk.
7. Add orphan cleanup, retention, authenticated download, and complete rule/integration tests.

Acceptance:

- App Check enforcement passes all staging journeys and blocks missing/invalid tokens.
- File uploads remain denied until every acceptance test passes.
- Spoofed MIME, oversized content, cross-session paths, replay, quota abuse, and orphan handling are tested.
- Original filenames and uploaded content never enter logs.
