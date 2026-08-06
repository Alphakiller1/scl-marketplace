# Whop app permissions — enabling SCL → Whop storefront sync

**Who this is for:** whoever owns the SCL app in Whop's developer dashboard.

**Time:** ~5 minutes in Whop, plus a re-approval click per connected capper.

**Why it matters:** SCL can already read a capper's Whop products. It cannot yet
_write_ back. Until the two permissions below are granted, editing a package
title or hiding an offer in SCL will not change anything on the capper's Whop
storefront.

---

## What is broken without this

`pushPackageToWhop` calls `PATCH /products/{id}` whenever an admin saves a
package or publishes/hides an offer. Whop's spec requires two permissions for
that endpoint:

| Permission               | Why the endpoint needs it                     |
| ------------------------ | --------------------------------------------- |
| `access_pass:update`     | Writing `title`, `headline`, `visibility`     |
| `access_pass:basic:read` | Reading the product back to confirm the write |

Without them Whop returns **HTTP 403**. The failure is deliberately quiet and
safe:

- The SCL edit **still saves**. Nothing is lost or rolled back.
- A warning is logged: `[whop-push] <packageId>: Whop rejected the update (HTTP 403)`.
- The admin sees no error, because the push runs in `after()` — after the
  response has already gone out.

So the symptom is not a crash. It is silence: SCL and Whop quietly drift apart.

---

## Step 1 — Add the permissions

1. Open the [Whop developer dashboard](https://whop.com/dashboard/developer).
2. Select the **SCL app**.
3. Click the **Permissions** tab.
4. Click **Add permissions**.
5. Add **both**:
   - `access_pass:update`
   - `access_pass:basic:read`

## Step 2 — Justify and mark each one

Whop asks for a justification per permission. Creators read this at install, so
it is worth writing plainly. Suggested text:

> **access_pass:update** — Keeps your Whop storefront in step with the changes
> you make on SCL. When you rename an offer or hide it on SCL, we apply the same
> change to your Whop product so the two never disagree. We never change your
> pricing.

> **access_pass:basic:read** — Reads your product back after an update so we can
> confirm the change landed.

Mark **both as required**. Two-way sync is not a side feature — if a creator
declines it, SCL and Whop drift silently, which is worse than not offering the
sync at all.

## Step 3 — Save

Click **Save** on the permissions tab.

---

## Step 4 — The part that is easy to miss

> Adding a permission to an app that is **already installed does not grant it.**

Per Whop's own documentation:

- Existing installs show a **Re-approve** button next to the app.
- **API calls needing the new permission keep failing until each creator
  re-approves.**

So after saving:

1. **Every already-connected capper must re-approve.** They do this at
   `Dashboard → Settings → Authorized apps` on Whop. Until they do, their
   storefront stays out of sync and the 403 warning keeps logging.
2. **Re-approve on your own test company too.** New scopes do not carry over
   automatically, even for the account that owns the app:
   <https://whop.com/dashboard/settings/authorized-apps>

At the time of writing this costs nothing, because **no capper has completed the
Whop OAuth connection yet** — see the blocker below. Do this now and the first
capper to connect gets working sync from their first minute.

---

## The larger blocker: nothing is connected yet

Permissions are necessary but not sufficient. As of 2026-08-06:

```sql
SELECT provider, status, count(*) AS connections,
       count(*) FILTER (
         WHERE "whopAccessToken" IS NOT NULL AND "whopCompanyId" IS NOT NULL
       ) AS whop_connected
FROM scl."StoreConnection" GROUP BY 1, 2;
```

Returned **`whop_connected = 0` for every row**, including the one whose status
is `LIVE`. That storefront's packages were entered by hand, not synced.

No connection means no company id, so:

- The **inbound** webhook (`product.created/updated/published/unpublished`)
  looks up a linked `StoreConnection` by company id, finds none, and skips.
- The **outbound** push has no access token, and no-ops.

**Neither direction can fire until one capper completes the Whop OAuth flow.**
Getting a single capper through it proves both directions at once.

---

## Step 5 — Verify end to end

Once permissions are granted and one capper is connected:

1. **Inbound.** In Whop, change that product's title. Within a few seconds the
   webhook should re-import and the new title should appear on the capper's SCL
   packages. If it does not, check that the `StoreConnection` row has a
   `whopCompanyId` matching the company that fired the webhook.

2. **Outbound.** In SCL admin (`/admin/store-setup`), edit the same package's
   title and save. Refresh the product on Whop — it should show SCL's title.

3. **Visibility.** Hide the offer in SCL. The Whop product should flip to
   `hidden`.

4. **Confirm no 403s.** Look for `[whop-push]` in the Vercel runtime logs. A
   successful push logs nothing; a rejected one logs the HTTP status.

A useful check that the link exists at all:

```sql
SELECT p.title, p."externalProductId", p."isActive",
       sc."whopCompanyId" IS NOT NULL AS connected
FROM scl."Package" p
JOIN scl."StoreConnection" sc ON sc.id = p."storeConnectionId"
WHERE sc.provider = 'WHOP';
```

A package with a **null `externalProductId` is not linked to a Whop product**
and will be skipped by the push. Run the Whop sync once on that connection to
establish the link before expecting outbound updates.

---

## What is deliberately _not_ synced

**Price.** On Whop a price lives on a **Plan**, not the Product. Writing one
changes what real customers are charged, so SCL does not touch it. SCL owns how
an offer is presented — title, headline, visibility. Whop remains the source of
truth for money.

If you later want price sync, it needs its own decision about which side wins
and what happens to existing subscribers. It is not a config change.

---

## Why this cannot loop

Worth knowing before you test: SCL pushes **only** on an explicit SCL edit, never
from the inbound sync. The cycle "Whop webhook → SCL sync → push back to Whop"
has no closing edge, because `syncWhopStorefront` never calls the push. Whop's
`product.updated` webhook writes the same values back into SCL, which is a
no-op, and there it stops.
