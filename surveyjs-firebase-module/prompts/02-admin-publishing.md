# Prompt 02 — Administration and publishing

Read `docs/MODULE-CONTRACT.md` and preserve the role matrix.

Goal: make survey authoring and lifecycle safe for non-developer staff.

Tasks:

1. Improve the existing JSON editor with schema diagnostics, question-name stability warnings, formatted import/export, and branch test scenarios.
2. Add optimistic-concurrency protection using a draft revision/precondition so two editors cannot silently overwrite each other.
3. Add preview modes for phone, tablet, and desktop without submitting data.
4. Add explicit validation for duplicate names, incompatible settings, inaccessible labels, excessive page/question counts, file questions while uploads are disabled, and unsupported HTML.
5. Keep `survey_editor` limited to drafts. Publish/close remains admin-only.
6. If adding SurveyJS Creator, first document the exact current license, package, developer count, cost decision, and fallback. Do not add it under an assumed open-source license.
7. Add a publish review showing changes from the last version, response/retention impact, public URL, and confirmation.

Acceptance:

- Concurrent edits produce a clear conflict instead of last-write-wins data loss.
- Publishing creates one immutable version and one public projection.
- Editing a live survey does not change respondents’ schema before the next publish.
- Unsupported file questions cannot be published.
- All role and invalid-schema paths have emulator tests.
