# Capper grade requests and cross-capper corrections

Cappers can ask SCL to **regrade** a pick or to apply **injury protection** from
their own pick history. Admins work those requests from the Grading tab and can
correct a pick for one capper or for every capper who logged it, in one save.

## Capper side

- **Where:** every graded pick on `/dashboard/picks` (and the Recent Plays list on
  `/dashboard`) shows **Request Regrade** and **Request Injury Protection**.
  Pending picks show neither. A pick that is already void shows Regrade only.
- **The request screen:** `/dashboard/picks/{straight|parlay}/{id}/request?type=regrade|injury-protection`.
  It is the support request email form with the subject (`Regrade Request` /
  `Injury Protection Request`), the pick, the date and the capper's details
  pre-filled. For a parlay, the capper can name the leg. **Commentary is
  required** (20–4,000 characters).
- **Trust:** the browser only sends the request type, pick id, optional leg and
  commentary. The pick, date, result and capper are read from the database and
  the session, and the pick must belong to the signed-in capper.
- **Limits:** one open request per type per pick; 10 requests per capper per hour.
- While a request is open, its button becomes a "… requested" chip.

## What SCL receives

1. A `GradeRequest` row (the system of record), with a snapshot of the pick and
   its result at the time of the request.
2. An email to `SUPPORT_EMAIL_TO` (the same inbox as the support form).
   Reply-To is the capper. It contains two links:
   - **Open pick correction screen** — `/admin/plays/{kind}/{id}?request={requestId}#capper-requests`
   - **All open requests** — `/admin/grading/requests`

If the email cannot be sent the request is still saved and listed; the failure is
recorded on the row (`emailError`) and shown in the queue.

## Admin side

- **Grading tab** (`/admin/grading`) lists every open request at the top, oldest
  first. The admin nav shows the count as `Grading (N)`.
- **Request history** (`/admin/grading/requests`): Open / Resolved / Declined / All.
- **Pick correction screen** (`/admin/plays/{kind}/{id}`):
  - **Capper Requests** — the request(s) on this pick with the capper's
    commentary. _Decline — result stands_ (note required), _Mark resolved_, or
    _Reopen_.
  - **Correct this pick** — choose the correct result and apply it to
    **Only this pick** or **Every capper with this pick**. Individual plays can
    be ticked or unticked. A preview shows every straight bet and parlay before
    and after.
  - **Edit several legs on this ticket** (parlays only) — the per-leg editor for
    changing more than one leg of one ticket in one save.

### What counts as "the same pick"

Same game (same provider event id; for legacy rows without one, the same clubs
within two hours), same market, same selection text, and — where stored — the
same side and line. The selection text matters: for a player prop it is the only
field that names the player (`side` is just "Over").

Picks on the same game at a **different line or side** (for a prop: any prop on
the same player) are listed separately as _related_. **Only a void can be
applied to them**, because a void does not depend on the line and a win or loss
does.

### What a correction does

- **Straight bets:** outcome and profit from the play's own odds and stake.
- **Parlay legs:** the leg's outcome changes and its ticket is re-settled from
  every leg (a voided leg drops out and the rest recombine).
- **All or nothing:** one transaction. If any selected play changed after the
  preview was opened, nothing is saved and the admin is asked to refresh.
- **Audit:** every changed play gets a `GradingAudit` row and every re-settled
  ticket a `ParlayGradingAudit` row (`MANUAL` for a first grade, otherwise
  `ADMIN_OVERRIDE`, with the admin and the reason). Because the last audit is a
  human one, the automatic reconcile pass leaves these results alone.
- **Requests close themselves:** open requests on the corrected picks are marked
  resolved with the applied result and reason. The single-pick and per-leg tools
  do the same.
- Leaderboard, profile and Discover caches are refreshed immediately.

## Code map

| Concern                                     | File                                                     |
| ------------------------------------------- | -------------------------------------------------------- |
| Labels, subjects, pick summaries (pure)     | `src/lib/grade-requests.ts`                              |
| Notification email (pure renderer)          | `src/lib/grade-request-email.ts`                         |
| Matching + settlement planning (pure)       | `src/lib/bulk-correction.ts`                             |
| Capper submit, admin decline/resolve/reopen | `src/lib/actions/grade-request.action.ts`                |
| Apply a correction to one or many plays     | `src/lib/actions/bulk-correction.action.ts`              |
| Candidate plays on the same game            | `src/lib/queries/bulk-correction.ts`                     |
| Queue / open-request queries                | `src/lib/queries/grade-requests.ts`                      |
| Table + enums                               | `prisma/migrations/20261112090000_capper_grade_requests` |
