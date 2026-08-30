# Capper lifecycle email automations

SCL owners manage these jobs from **Admin → Capper Emails → Automated follow-ups**. Both jobs are off until an owner explicitly enables them after deployment.

## Rules

- **Unverified account reminder:** sends one fresh 24-hour verification link after the configured wait (minimum 24 hours). Eligible accounts must be new, non-test, non-legacy cappers that remain unverified and are not suspended or disabled.
- **No-plays getting-started email:** sends once after the configured wait following email verification. Eligible accounts must be new, verified, active cappers with no straight plays and no parlays. Marketing opt-outs are excluded and the message includes an unsubscribe link.

Turning a rule off and back on starts a fresh signup cohort. This intentionally prevents a long pause—or the first production deployment—from creating a historical roster blast.

## Delivery safeguards

- The scheduler checks hourly at `/api/cron/email-automations` and requires `Authorization: Bearer $CRON_SECRET`.
- A database lock prevents overlapping runs.
- A unique database record permits only one delivery per capper and rule.
- Provider retries reuse a stable idempotency key and stop after three attempts.
- Eligibility is checked again immediately before delivery.
- Both jobs share an owner-configurable rolling-24-hour limit of 1–50. The ceiling preserves at least half of the known 100-message allowance for verification, password resets, previews, and owner email.
- Placeholder addresses, test accounts, legacy imports, suspended accounts, and disabled accounts are not lifecycle targets.

## Editable content

The **Verification reminder** and **No-plays follow-up** templates appear alongside the existing Welcome, Verify email, Password reset, Claim account, and Password update templates. Owners can edit the subject, body, button label, and small print and send themselves a preview. Destination URLs remain server-controlled.

## Deployment checklist

1. Apply migration `20260829140000_email_automations`.
2. Confirm `RESEND_API_KEY`, `EMAIL_FROM`, `AUTH_SECRET`, and `CRON_SECRET` are configured.
3. Open the Capper Emails page and verify both rules still show **Off**.
4. Send previews of both templates to an admin inbox.
5. Enable one rule at a time and save. Only accounts created after that enable action can qualify.
6. Confirm the first hourly run appears under **Automation activity** before enabling the second rule.
