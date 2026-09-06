# Tennis stale grading regression coverage

Related investigation: #635. No database migration is required.

## Failures and fixes

- Both grading queues linked parlay legs to `/admin/plays/straight/<leg-id>`, where the straight-only query returned no record. Queue links now open the parent ticket. Old links redirect after an admin check.
- Settlement review used public publication filters. An existing committed record could become inaccessible because its capper or stake no longer qualified for public display. Operational review now requires a live admin session and a committed straight play or committed parlay, independently of public eligibility. Public ledger filters are unchanged.
- ESPN's current tennis cards disappear when a tournament changes. The grader now sends pending tennis fixture dates to the historical provider, including older fixtures and legacy creation-date fallbacks. Current and dated cards are deduplicated; request concurrency, per-request timeout and total history time are bounded.
- At combined tournaments ESPN copies the requested tour's format onto both draws. Women's singles and men's qualifying are normalized to best-of-three; the provider selects each singles draw from its own tour, retaining men's main-draw best-of-five. Retirements and walkovers are not treated as normal finals.
- Automatic updates now require the play to still be pending. Manual straight saves compare the stored outcome and profit atomically. Manual and automatic parlay settlement share a parent-row lock, and automatic parent settlement rereads the legs inside that lock. A manual parlay save also updates effective combined odds.

## Verification

The standard CI verify job runs the grading test suite. Tests exercise actual route/query/action modules with explicit I/O doubles: parent routing, old-link redirects, authorization before reads, operational lookup filters, historical rollover, feed failures, format handling, manual profit/audit writes, and concurrent-result rejection. Existing cross-sport outcome and matching tests run with these checks.

The marketplace smoke job also runs `scripts/smoke-grading-locks.ts` against its isolated PostgreSQL service. It verifies that a competing transaction waits for the parent lock and sees the manually settled result after release. The script refuses non-local databases and removes its test fixtures.

A local replay of ATP/WTA cards fetched on 2026-09-06 increased fixtures with usable game scores from 120 to 450 (330 recovered feed fixtures, not user plays). This verifies parsing behavior; it does not claim that any production user record was changed.

## Release checks

After deployment, verify both stale queues open straight and parlay records under an authorized SCL admin/owner account, including an old straight URL for a leg. Verify a completed tennis fixture grades on the scheduled run, with one audit entry and correct parent profit. Check the manual queue for genuine exceptions. The Rafael Jodar entry reported in #635 had a different booked opponent from the result feed and needs a verified book-specific ruling; do not infer its grade from Jodar's name alone.

No code change can guarantee zero future regressions or external-feed coverage. Missing or ambiguous results remain available for manual review; they must never be guessed.
