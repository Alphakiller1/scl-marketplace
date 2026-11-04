# Automatic grading runs in the cloud

Vercel runs `/api/cron/grade` every 30 minutes at minutes 3 and 33.
The owner requested this cadence on November 4, 2026. It does not depend on a
PC, browser tab, or local dev server.

`.github/workflows/grade-cron.yml` is manual recovery and verification only;
it has no scheduled trigger. This prevents extra automatic grading between
Vercel's half-hour slots. Both entry points call the production grading route,
which authenticates requests and prevents overlapping runs.

## Diagnose a red run

- No Vercel requests: inspect the production project's enabled cron definitions,
  deployed commit, and authentication configuration.
- HTTP 401: check the scheduler's configured secret against production.
- HTTP 409: another grading run holds the lock; the backup treats this as a no-op.
- HTTP 500: inspect the recorded exception and provider/database failures.
- HTTP 503: the endpoint ran, but grading health reports overdue eligible plays.
  Inspect `skippedByReason` and delayed-play diagnostics before changing schedules.

The November 4 failures were HTTP 503, with 99 straight plays and 9 parlay legs
past expected final. Replaying 74 pending NCAAB plays from production diagnostics
against the complete Division I scoreboard plus school aliases recovered all 74.
The ranked-only card and differences such as Murray St / Murray State had
prevented those fixture joins.

After the first production recovery, seven straight plays and two parlay legs
remained across four fixtures. The follow-up aliases cover Fort Wayne / Purdue
Fort Wayne, New Orleans / LSU New Orleans, Cal Baptist / California Baptist,
and CS Fullerton / Cal State Fullerton. Both opponents and scheduled start remain
required for cross-provider joins; no mascot-only or time-only fallback is added.

Production must receive the merged code before the next automatic run can use
these changes. A preview deployment alone leaves the production grader unchanged.
Never use a preview grading mutation as a test: previews can share the production
database. Use pure fixture replay and mocked I/O for pre-deploy validation.

After deployment, inspect the new production cron logs and the grading workflow.
Two manual-only tennis markets may remain pending for human review; they are
reported separately from automatically eligible overdue plays.
