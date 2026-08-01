# Whop API Setup — Owner Guide

**Who this is for:** the SCL owners (the people who control the Whop account for
`scleaderboard@gmail.com`).
**Why:** so SCL can stop tracking affiliate sales by hand and pull referrals, conversions,
and commissions automatically into the new site.
**Time:** ~15 minutes for Parts 1–4. Part 5 is an ongoing ask to each capper.

---

## 0. What we need back from you (the short version)

When you're done, five values will exist. **Do not send them in Discord, text, or email** —
see [§6 How to hand these over](#6-how-to-hand-these-over-securely).

| #   | What                          | Looks like                      | From   |
| --- | ----------------------------- | ------------------------------- | ------ |
| 1   | Account API key               | `whop_xxxxxxxxxxxx`             | Part 2 |
| 2   | App ID                        | `app_xxxxxxxx`                  | Part 3 |
| 3   | App API key                   | `whop_xxxxxxxxxxxx`             | Part 3 |
| 4   | Webhook signing secret        | `ws_xxxxxxxxxxxx`               | Part 4 |
| 5   | SCL's Whop affiliate username | e.g. `sportscappersleaderboard` | Part 5 |

---

## 1. Before you start

1. Log in at **[whop.com/dashboard](https://whop.com/dashboard)** as the SCL account.
2. If the account has more than one business, use the **business switcher** (top-left) and
   select the SCL business. Every key you create belongs to whichever business is selected —
   picking the wrong one is the single most common mistake here.
3. Confirm you have **owner or admin** access on that business. Member-level access can't
   create API keys.

---

## 2. Create the Account API key (do this first)

1. Go to **[whop.com/dashboard/developer](https://whop.com/dashboard/developer)** — the
   **Developer** tab in the left sidebar.
2. Find the **Account API Keys** section (older accounts may still label it **Company API
   Keys** — same thing).
3. Click **Create** in the top right.
4. **Name it** `SCL Production`. (If you also want a test key, make a second one named
   `SCL Local Development` — never reuse one key for both.)
5. **Permissions.** Whop lets you pick the `Admin` role or a custom permission set. Pick
   **Admin** to get it working, and tell us — we'll come back and narrow it to read-only once
   the integration is live. The permissions we actually use are:
   - `affiliate:basic:read` — read affiliate records and referral earnings
   - membership read — see who converted
   - payment read — see what they paid
     SCL never needs write, payout, or refund permission on your account. If the custom
     permission picker is easy to use, grant only those three and skip Admin entirely.
6. **Copy the key immediately.** Whop shows it **once**. If you close the dialog without
   copying, delete that key and create a new one — there's no way to view it again.

> **Never** paste an Account API key into browser code, a public repo, a screenshot, or a
> chat. It can act as your business.

---

## 3. Create the SCL Whop app

The Account API key from Part 2 only reads **your own** Whop business. To read affiliate data
on a **capper's** Whop store, that capper has to grant SCL access — and the clean way to do
that is a Whop app they install in one click, instead of every capper mailing us a key.

1. Still under **[whop.com/dashboard/developer](https://whop.com/dashboard/developer)**, click
   **Create App**.
2. **Name:** `Sports Cappers Leaderboard`. Add the SCL logo if it asks — cappers see this on
   the install screen, so it should look legitimate.
3. After it's created, open the app and copy:
   - **App ID** (`app_…`)
   - **App API key** (`whop_…`) — again, shown once
4. **Redirect / callback URL**, if the app settings ask for one, use:
   `https://sportscappersleaderboard.com/api/whop/callback`
   (We'll have that route live before you send anyone the install link — if it's not built
   yet, save the app anyway and we'll fill this in.)
5. **Permissions the app requests:** the same three reads as above. Keep it read-only. Cappers
   are far more likely to install something that can't touch their money.

---

## 4. Create the webhook

Webhooks are how SCL learns about a sale **the moment it happens**, instead of polling.

1. **[whop.com/dashboard/developer](https://whop.com/dashboard/developer)** → **Create Webhook**
   (top right).
2. **URL:** `https://sportscappersleaderboard.com/api/webhooks/whop`
3. **API version: `v1`.** Not v2, not v5. If the version selector shows anything else, change
   it — the wrong version sends a payload shape we won't parse.
4. **Events to select:**
   - `payment.succeeded`
   - `membership.activated`
   - `membership.deactivated`
   - `refund.created`
   - `dispute.created`
5. **Copy the signing secret** (`ws_…`). We use it to verify that incoming requests are really
   from Whop and not someone spoofing sales into our numbers.

---

## 5. Confirm the affiliate username and link format

This part is worth more than the API keys, and it costs nothing.

Whop attributes a referral by a **`?a=` parameter** on the checkout URL — e.g.
`https://whop.com/some-capper/?a=sportscappersleaderboard`. When a buyer clicks it, Whop drops
a cookie with a **30-day attribution window**; a purchase inside that window pays SCL.

**What we need from you:** the exact affiliate username on the SCL Whop account, character for
character. Find it under your affiliate/referrals page —
[whop.com/affiliates](https://whop.com/affiliates/) — or in any referral link Whop generates
for you.

**Two ways this silently breaks — check both:**

- **A missing `?a=`.** A checkout link without it pays SCL nothing, and looks completely
  normal otherwise. There is no error, just no commission.
- **An escaped `&`.** If a link gets stored or pasted as `&amp;a=…` instead of `&a=…`, Whop
  reads the parameter as `amp;a` and drops the attribution. This exact bug wiped the affiliate
  code off **118 of 122** links in the legacy site's package data, so it is not hypothetical.
  If you paste links through a rich-text editor or a CMS, verify the raw URL afterward.

---

## 6. How to hand these over securely

**Best option — you paste them yourself, and nobody transmits a secret at all:**

1. Go to the SCL project in **Vercel** → **Settings** → **Environment Variables**.
2. Add each of these for **Production** (and Preview if you want the test key there):

   | Variable                  | Value                           |
   | ------------------------- | ------------------------------- |
   | `WHOP_API_KEY`            | Account API key (Part 2)        |
   | `WHOP_APP_ID`             | App ID (Part 3)                 |
   | `WHOP_APP_API_KEY`        | App API key (Part 3)            |
   | `WHOP_WEBHOOK_SECRET`     | Webhook signing secret (Part 4) |
   | `WHOP_AFFILIATE_USERNAME` | Affiliate username (Part 5)     |

3. Tell us they're in, and we'll deploy against them. We never need to see the values.

If you'd rather we set them up, use a **one-time secret link** (1password, Bitwarden Send, or
`onetimesecret.com`) — not chat, not email. **If a key ever lands in a chat message, treat it
as burned:** delete it in the Whop dashboard and create a new one. Deleting a key is instant
and free.

---

## 7. What to ask each capper (copy/paste this)

Automating attribution on a capper's store needs _their_ permission — Whop scopes affiliate
data to the business that owns it, so our key can't see their sales on its own. Send this:

> Hey — we're automating payout tracking on SCL so your sales and commissions show up on your
> SCL profile automatically instead of us reconciling them by hand.
>
> Two things, both quick:
>
> 1. **Add us as an affiliate on your Whop.** Whop dashboard → Affiliates → add
>    `scleaderboard@gmail.com`, set the commission we agreed on, and apply it to all current
>    and future plans.
> 2. **Install the "Sports Cappers Leaderboard" app** on your Whop business: `<install link>`.
>    It's read-only — it can see referrals, memberships, and payments so we can credit sales
>    correctly. It cannot issue refunds, move money, or change your products.
>
> That's it. Your packages then sync to SCL on their own.

If a capper won't install the app, the fallback is for them to create a **read-only Account API
key** on their business (Part 2 steps, permissions limited to `affiliate:basic:read` +
membership read + payment read) and send it via one-time link. That works, but it's a key per
capper to store and rotate, so treat it as the exception.

---

## 8. What this actually gets us, and what it doesn't

> **The keys don't turn anything on by themselves.** Right now SCL makes no calls to Whop at
> all — packages are typed in by hand in the admin panel. These credentials are what _lets us
> build_ the sync; the list below is what we can build once we have them, not what happens the
> moment you paste them in. Storefronts will not start updating on their own until that work
> ships.

**Automated once you finish Parts 1–4:**

- Real conversions on SCL's own Whop business, live via webhook
- Verified affiliate earnings replacing hand-kept numbers
- Click → sale matching, so `/go/[slug]` click counts finally connect to revenue

**Automated per capper, only after they install the app (Part 7):**

- That capper's package sales and commissions
- Auto-import of their packages instead of us pasting checkout links

**Still manual, by Whop's design:**

- Commissions hold for **30 days** after the referred purchase before payout — a sale showing
  today is not money today, and the site will show it as pending.
- **Refunds reverse commissions.** Numbers can move down after the fact; that's correct
  behavior, not a bug in our tracking.
- Attribution is **30 days from click**. A buyer who clicks today and buys in six weeks pays
  us nothing, and no API can recover that.

---

## 9. If something goes wrong

| Symptom                           | Cause                                        | Fix                                   |
| --------------------------------- | -------------------------------------------- | ------------------------------------- |
| Key doesn't work at all           | Created under the wrong business             | Switch business, create a new key     |
| `401 Unauthorized`                | Key deleted, or pasted with a trailing space | Recreate; re-paste carefully          |
| `403 Forbidden` on affiliate data | Missing `affiliate:basic:read`               | Recreate the key with that permission |
| Webhook never fires               | API version not `v1`, or wrong URL           | Edit the webhook, set v1              |
| Sales show but no commission      | `?a=` missing or `&amp;`-escaped on the link | See Part 5                            |
| Capper's sales invisible          | They haven't installed the app               | Resend Part 7                         |

**Reference docs:** [Whop developer quickstart](https://docs.whop.com/developer/api/quickstart)
· [Affiliates guide](https://docs.whop.com/developer/guides/affiliates)
· [Webhooks guide](https://docs.whop.com/developer/guides/webhooks)
· [Affiliate API reference](https://docs.whop.com/api-reference/affiliates/list-affiliates)
