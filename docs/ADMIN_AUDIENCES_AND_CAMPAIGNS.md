# Admin operational audiences and campaigns

The Admin Overview and Admin → Mass Email share one audience engine. Dashboard
cards link to the exact filter payload used to calculate their count, and the
composer re-resolves that payload before creating a campaign. This prevents a
dashboard segment and its email audience from drifting apart.

## Operational definitions

- **Active plays** are unresolved, committed positions currently tracked by
  SCL: pending straight plays plus pending parlays. Future and in-progress
  events count. A position leaves the total only after it is graded/closed.
- **Started · pending grade** is the narrower operational queue: unresolved
  positions whose event (or every parlay leg) has started.
- Play-volume metrics count positions, not parlay legs.
- Storefront **connected** means a live connection or a live carried package.
- Dashboard audience cards show announcement-eligible cappers. Test accounts,
  restricted accounts, marketing opt-outs, placeholder addresses, and duplicate
  inboxes are suppressed, so the number matches the campaign preview. Addresses
  with a prior hard bounce, block, or invalid-address event are also suppressed.

## Audience filters

Filters are combined with AND semantics. The initial set covers join date,
account activity, play inactivity, verification, play history, storefront
connection, and storefront review state. Manually removed recipients are stored
as exclusions in that campaign's filter snapshot. Saved groups persist the same
validated JSON structure in `AudienceGroup`.

## Durable Brevo queue

Creating a campaign writes the campaign and one unique recipient row before any
provider request. `/api/cron/broadcast-queue` claims due campaigns and sends at
most `BREVO_QUEUE_BATCH_SIZE` recipients per run while enforcing
`BREVO_DAILY_LIMIT` across a conservative rolling 24-hour window. Recipient rows are reserved
before the provider call, and `(broadcastId, address)` is unique. A PostgreSQL
advisory lock makes the rolling daily-limit reservation atomic across immediate
and cron workers, while Brevo receives a per-recipient idempotency key as an
additional duplicate-send guard.

Configure:

```dotenv
BREVO_API_KEY=""
BREVO_EMAIL_FROM="SCL <no-reply@sportscappersleaderboard.com>"
BREVO_DAILY_LIMIT="300"
BREVO_QUEUE_BATCH_SIZE="50"
BREVO_WEBHOOK_SECRET=""
```

Keep Resend configured for account/security and lifecycle email. Brevo is used
only for admin campaigns.

## Tracking webhook

Configure Brevo transactional events to POST to:

```text
https://YOUR_HOST/api/webhooks/brevo?token=BREVO_WEBHOOK_SECRET
```

Delivered, opened, bounced, and unsubscribed events update the recipient ledger
and campaign rollups. An unsubscribe also updates `User.marketingOptOut`, so all
future campaign previews suppress that account.

## Deployment

1. Apply migration `20261001090000_admin_audiences_brevo_queue`.
2. Add the Brevo environment variables in Vercel.
3. Create the Brevo webhook using the secret URL above.
4. Keep `CRON_SECRET` configured; the queue route fails closed without it.
5. Send a small internal campaign and verify the queued → sent → delivered/opened
   transitions before using the full roster.
