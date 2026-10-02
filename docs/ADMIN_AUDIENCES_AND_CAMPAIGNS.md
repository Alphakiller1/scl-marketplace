# Admin operational audiences and campaigns

The Admin Overview, the audience list (`/admin/audiences`), and Admin → Mass
Email share one audience engine (`src/lib/admin-audience.ts` for the filter
rules, `src/lib/admin-audience-members.ts` for resolution). Every dashboard
number links to the exact list behind it, and that list links to the composer
with the same filters, which re-resolves them before a campaign is created. A
dashboard number, its list, and its email audience cannot drift apart.

## Operational definitions

- **Active plays** are unresolved, committed positions: pending straight plays
  plus pending parlays (a parlay is one position, not its legs). Upcoming and
  in-progress events both count. Grading or closing a position removes it.
- **Pending grades** is the subset that now needs a grading action: the event
  has started (for a parlay, every leg has), or no start time is known and the
  play has been open for more than 12 hours. Legacy imports without a start time
  therefore cannot sit unresolved and invisible.
- **Plays submitted** counts positions created in the last 7 / 30 days.
- Storefront **connected** means a live connection or an active carried package
  with a checkout URL. **Awaiting SCL review** means a connection pending SCL
  acceptance or link import, or flagged as needing attention. The review-queue
  link under that section still counts storefront connections.
- Test accounts and the `@ghost.scl.demo` roster are never counted.

## Group size vs. emailable

Each dashboard card shows the full group (the length of the list it opens) and,
beneath it, how many of them are **emailable**. Emailable excludes opt-outs,
suspended or disabled accounts, placeholder addresses, addresses that hard
bounced / were blocked / were invalid in an earlier campaign, and duplicate
inboxes (one inbox is mailed once, as its oldest account). The emailable number
is exactly the recipient count the composer shows for that group. The audience
list shows why each non-emailable capper is excluded.

## Audience filters

Filters combine with AND: join date, account status (inactive = pending,
suspended, or disabled), played within 3/7/14/30 days, no plays within
3/7/14/30 days (includes cappers who never submitted), verification, play
history, storefront connection, and storefront review state. Saved groups store
the same validated JSON in `AudienceGroup`; every field has a default, so a new
filter (sport, for example) is one more schema field and old groups still parse.

Removing a recipient in the composer re-resolves the audience on the server. A
removal withdraws that inbox, so another account sharing the address does not
receive the email instead. Removals are stored in the campaign's filter
snapshot.

## Creating a campaign

- The composer sends a per-submission `requestKey` (unique in the database), so
  a double click or a retried request returns the campaign already created.
- The server confirms both the recipient count and a fingerprint of the exact
  recipient set the admin reviewed.
- The same subject and body inside 24 hours requires an explicit "send it again".
- A schedule must be in the future and at most 60 days ahead. The queue sends
  within about 5 minutes of the scheduled time.
- Queued and scheduled campaigns can be cancelled from the email history; unsent
  recipients are marked skipped.

## Durable Brevo queue

Creating a campaign writes the campaign and one unique recipient row per inbox
before any provider request. `/api/cron/broadcast-queue` (every 5 minutes)
claims due campaigns and sends at most `BREVO_QUEUE_BATCH_SIZE` recipients per
run, enforcing `BREVO_DAILY_LIMIT` across a rolling 24-hour window. A campaign
larger than the remaining allowance stays queued and continues the next day.

Duplicate protection is the queue itself — Brevo's send API has no request
idempotency:

1. Each recipient row is reserved (status `SENT`, `sentAt` set) inside a
   transaction holding a PostgreSQL advisory lock, which also makes the daily
   limit atomic across the cron and the immediate post-send run.
2. Only a definitive refusal from Brevo re-queues a row: `429`/`401`/`402`/`403`
   stop the whole run (the account is refused), `5xx` retries up to 5 times.
   A network error or timeout has an unknown outcome and is **not** retried.
3. A row reserved by a worker that died before Brevo answered is marked failed
   ("outcome unknown") after 15 minutes rather than resent.
4. Only campaigns created by this queue (`provider = 'BREVO'` with a
   `requestKey`) are ever sent. Rows from the previous Resend sender are history.

Each recipient is re-checked at send time: a capper who opted out, was
suspended, changed address, or bounced in another campaign after the campaign
was queued is skipped.

Configure:

```dotenv
BREVO_API_KEY=""
BREVO_EMAIL_FROM="SCL <no-reply@sportscappersleaderboard.com>"
BREVO_DAILY_LIMIT="300"
BREVO_QUEUE_BATCH_SIZE="50"
BREVO_WEBHOOK_SECRET=""
```

Keep Resend configured for account/security and lifecycle email. Brevo is used
only for admin campaigns; without the Brevo settings the composer refuses to
create a campaign and the queue does nothing.

## Unsubscribe

Mass campaigns carry a signed unsubscribe link in the footer and RFC 8058
`List-Unsubscribe` / `List-Unsubscribe-Post` headers pointing at
`/api/unsubscribe`. Opening `/unsubscribe` shows a confirm button — a page load
changes nothing, so link scanners cannot opt people out. Confirming sets
`User.marketingOptOut` and withdraws the capper from every queued campaign.
Direct one-capper messages are operational and ignore the opt-out.

## Tracking webhook

Create a Brevo transactional webhook for delivered, opened, hard/soft bounce,
blocked, invalid email, spam, unsubscribed, and error events, posting to
`https://YOUR_HOST/api/webhooks/brevo`. Authenticate with a custom header
`x-scl-brevo-secret: BREVO_WEBHOOK_SECRET` (preferred), a bearer token, or HTTP
basic auth with the secret as the password. `?token=` still works but puts the
secret in request logs. Batched (array) payloads are accepted.

Events update the recipient ledger and campaign report (queued, sent, delivered,
opened, bounced, unsubscribed, failed) using the event's own timestamp. Apple
Mail proxy opens count as delivery, not as opens. A spam complaint or
unsubscribe opts the capper out of all future and queued campaigns.

## Deployment

1. Merge to `main`. The production build applies
   `20261001090000_admin_audiences_brevo_queue` and
   `20261001120000_broadcast_queue_hardening`; both are additive and the second
   is safe to re-run.
2. Add the Brevo environment variables in Vercel (Production) and redeploy.
3. Create the Brevo webhook as above.
4. Keep `CRON_SECRET` and `AUTH_SECRET` configured; the queue route fails closed
   without `CRON_SECRET`, and mass campaigns wait without `AUTH_SECRET`.
5. Send a small internal campaign and verify queued → sent → delivered/opened
   before using the full roster.
