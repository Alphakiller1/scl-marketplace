# Automatic grading runs in the cloud

Vercel runs `/api/cron/grade` every 30 minutes at minutes 25 and 55.
The owner requested this cadence on November 4, 2026, and the overnight deadlines
on November 6. The last pre-deadline slots are 4:55 and 6:55 a.m. Eastern,
allowing the route's five-minute maximum runtime before each deadline.
It does not depend on a
PC, browser tab, or local dev server.

## Overnight grading deadline

Grade the previous Eastern calendar day's slate by **5 a.m. America/New_York**.
Exceptions must be resolved by **7 a.m. Eastern**. Older unresolved slates remain
breached; the daily counter never resets them away. Late evening games whose
UTC start falls on the next date still belong to their Eastern calendar date.
Games starting on today's Eastern date are today's slate.

From 3 a.m. through the 6:55 a.m. run, the existing half-hour invocation uses
the full results stack, including Odds API **scores** for every pending sport.
It never requests odds prices. Other hours retain the credit-saving stack.
The independent free ESPN/official feeds remain available in both modes.

Health and the admin queue include every previous-slate committed straight play
and parlay leg on an active public record, including manual-only markets and
missing scheduled-start metadata. Missing schedules use publication date only
to request review, never to determine an outcome. There is no 50/1000-row cap.
At 5 a.m. any unresolved prior-slate play makes health UNHEALTHY and the cron
returns HTTP 503; at 7 a.m. its daily status is BREACHED. Counts and status are
stored in the job's health metadata and shown in the admin console.

Operators must clear the priority queue before 7 a.m. using verified results and
the audited admin override for exceptions the providers cannot settle. A clock
deadline alone never creates a win/loss/void. Live/suspended matches or missing
evidence remain pending and fail the deadline until a verified ruling is saved.
This is a monitored grading requirement, not a guarantee of provider uptime.

Confirmed tennis walkovers with no playing scores settle as VOID across match
markets and parlay legs. Retirement or contradictory walkover data still needs
review. The November 5 Alcaraz–Berrettini walkover is covered by regression tests.

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
  Inspect `health.dailyDeadline`, `priorSlatePending`, `skippedByReason` and
  delayed-play diagnostics before changing schedules.

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
Manual-only markets are reported separately from automatically eligible overdue
plays and also count against the daily deadline. They cannot hide a late slate
behind a HEALTHY run.
