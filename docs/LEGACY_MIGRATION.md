# Legacy Capper Migration

Imports cappers from the previous SCL platform (sportscappersleaderboard.com)
into the new `scl` schema as **public, claimable profiles**, flagged
`isLegacy = true` so their provenance is shown honestly on every surface.

No schema migration is required — it reuses the existing `User`,
`CapperProfile` (`isLegacy`), and `Play` models.

## What it creates

For each record the importer upserts:

- a **`User`** (`role: CAPPER`, **no SCL password**; `emailVerified` set only
  when `verified: true`). `username` becomes the public `/cappers/[handle]` slug.
  When the export carries a credential the capper signs in with their old
  password — see [Signing in with the old password](#signing-in-with-the-old-password);
  otherwise the record stays unclaimed until they set one
  ([Claiming an imported account](#claiming-an-imported-account)).
- a **`CapperProfile`** with `isLegacy: true` plus headline/bio/sports/socials.
- the capper's **historical `Play` rows** (only if the profile has none yet).

Imported cappers appear on the live leaderboard, directory, and profile pages
with a **"Legacy"** badge. Their stats are computed from the imported plays by
the same `computeCapperStats` used for native cappers — nothing is fabricated.

## Input format

A JSON array of capper records. See [`prisma/legacy-cappers.example.json`](../prisma/legacy-cappers.example.json)
for a complete example; the contract lives in
[`src/lib/schemas/legacy-import.schema.ts`](../src/lib/schemas/legacy-import.schema.ts).

| Field                                                   | Required | Notes                                            |
| ------------------------------------------------------- | -------- | ------------------------------------------------ |
| `username`                                              | ✅       | 3–30 chars, `[a-zA-Z0-9_]`; the public handle    |
| `displayName`                                           | ✅       | shown name                                       |
| `email`                                                 | —        | defaults to `username@legacy.scl` (placeholder)  |
| `verified`                                              | —        | `true` marks the imported record verified        |
| `passwordHash`, `passwordFormat`                        | —        | the old platform's credential (see below)        |
| `headline`, `bio`, `avatarUrl`                          | —        | profile copy                                     |
| `sports`, `specialties`, `betTypes`                     | —        | arrays                                           |
| `providerType`                                          | —        | `FREE` \| `PREMIUM` \| `HYBRID` (default `FREE`) |
| `instagram`, `twitter`, `facebook`, `tiktok`, `website` | —        | handles/URL                                      |
| `plays[]`                                               | —        | historical plays (see below)                     |

Each play: `sport`, `market`, `selection`, `oddsAmerican` (int), `units`
(positive), `outcome` (`WIN`/`LOSS`/`PUSH`/`VOID`/`PENDING`), optional
`profitUnits` (computed from odds/units when omitted), optional `gradedAt` /
`createdAt` (ISO dates).

## Running it

The importer writes to whatever database `DATABASE_URL` points at, so be
deliberate about the target.

```bash
# 1. Put the real export at prisma/legacy-cappers.json (gitignored), or pass a path.
npm run db:import-legacy -- path/to/legacy-cappers.json
```

- **Idempotent:** re-running upserts profiles and skips play insertion for any
  capper that already has plays.
- **Validation:** the whole file is validated first; on failure it prints the
  errors and exits non-zero without writing.
- **Per-record resilience:** a single failing record (e.g. a username clash) is
  reported and skipped; the rest still import.

> ⚠️ **Production note.** Per the "honest production" decision
> ([OWNER_DECISIONS](../../SCL/_phase1-notes/OWNER_DECISIONS.md)), only import
> **real** legacy data into production. The demo seed (`@scl.demo`) is for local
> /preview only. Because the local `.env` currently points at the production
> pooler, run imports against the intended database deliberately.

## Extracting from the raw cPanel export

`scripts/extract-legacy-mysql.py` converts the legacy MySQL dumps straight into
both import files, so nothing is hand-transcribed:

```bash
python scripts/extract-legacy-mysql.py   --site        ~/Downloads/scleaderboard_sclsite.sql   --records     ~/Downloads/scleaderboard_sclsite_records.sql   --out         prisma/legacy-cappers.json   --records-out prisma/legacy-records.json
```

Two things about the source data are worth knowing before trusting the output:

**Stakes.** Legacy `Units` is the amount played _to win_, not the amount risked.
The real stake is `urisk` (it equals risk-to-win(Units, odds) on 4432/4433 rows)
and realized profit is `uret` (`-urisk` on 100% of losses). The extractor maps
`units <- urisk` and `profitUnits <- uret`. Reading `Units` as the stake would
understate every favorite's risk and inflate ROI across the board.

**History depth.** The old platform pruned individual picks on a rolling 90-day
basis — `stats90` accounts for exactly the number of surviving pick rows. Only
~16% of its recorded history has pick-level detail; the rest survives only as
the stored totals described below.

## Carried-over records (aggregate totals)

`LegacyRecord` holds the totals the old platform kept after pruning the picks
behind them, so a capper's history still counts toward their standing.

```bash
# Run AFTER db:import-legacy — records attach to profiles it creates.
npm run db:import-legacy-records -- prisma/legacy-records.json
```

Scope names in the legacy database are misleading and were decoded against the
live site: `stats1` is the current **year** (not one day) and drives
current-year.php; `stats_current` is the current **season** and drives
current-season.php.

**All-time standings fold `PRE_IMPORT` plus prior complete years
(`YEAR_2025`, `YEAR_2024`).** `PRE_IMPORT` is the legacy calendar-year total
_minus_ the plays imported as real `Play` rows, so adding it to computed stats
reproduces the current-year total without counting the ~90 days present in both.
Prior years do not overlap those receipts (the mid-2026 export's pick rows all
fall in 2026). Trailing windows and seasons stay out: they overlap `PRE_IMPORT`
and/or the imported plays, and an all-sports headline cannot coherently add
"current season" figures when NFL, NBA, MLB, and the other sports all have
different season boundaries.

Where it applies:

- **All-time** leaderboard, public profile, and Discover's base summary — yes.
- **Trailing windows** (7d/30d/90d), Discover's windowed and specialty lanes —
  no. Those are about current form, and the legacy figures are a frozen snapshot
  from the export date.
- **Form, streak, and performance trend** stay play-derived everywhere. The
  export carries totals with no per-pick sequence, so seeding them would invent
  a shape the source never had.

### Source data quality

The legacy accumulator is not always sound, so the extractor reports what it
had to correct and drops what it cannot reason about:

- **Negative counts** (a regrade decrementing twice — 4 rows, all NCAAF) are
  floored to zero. That is not a number of results, it is a bug; the valid
  wins/losses in the same slice are kept.
- **Slices with no units risked** are dropped (2 rows). A push-only slice
  returns the stake and carries neither a W/L record nor a computable ROI, and
  decided results with zero risk are a genuine source error.

Both are counted in the run's `row warnings` — a clean run should print none
beyond these. The Zod contract rejects either shape independently, so a
regression cannot reach the database silently.

The importer refuses to attach records to a profile that is not `isLegacy`, so
carried-over totals can never inflate a natively-grown capper. Surfaces that
include them render the `Legacy` badge with the carried count.

## Storefront packages

`aff_subscriptions` holds the previous platform's affiliate offers — 122 across
56 cappers, almost all Winible checkout links.

```bash
# Run AFTER db:import-legacy — offers attach to the profiles it creates.
npm run db:import-legacy-packages -- prisma/legacy-packages.json
```

The importer now performs a mandatory field-by-field readback after writing:
package identity, owner, title, description, price, billing cadence, provider,
checkout URL, tracking target, display order, and active state must all match the
source file or the command exits non-zero. The same audit can be rerun without
writing anything:

```bash
npm run verify:packages -- prisma/legacy-packages.json
```

Production deploys also run `verify:packages` after migrations and fail closed
when the documented 122-offer baseline, the audited create/delete lineage,
tracking invariants, or known corrective package expectations regress. The
three migrated Whop offers are checked by exact owner, title, provider, active
state, and checkout URL. The historical "120 Winible / 4 Whop" aggregate also
included one non-legacy Whop package and must not be used as the legacy-only
baseline.

Three things the importer has to get right:

- **Every package gets a `TrackingUrl`.** `listActiveMarketplacePackages`
  filters out any package without one, so an offer imported without a slug
  exists in the database and is invisible on `/packages`.
- **`storeConnectionId` stays null.** The public predicate accepts either a LIVE
  store connection or no connection at all; these offers were already live.
- **The slug is deterministic** — `<username>-<legacyRef>`, where `legacyRef` is
  the legacy affiliate code (unique per offer). That keeps re-runs idempotent
  and means a shared `/go/` link never breaks.

### Prices are deliberately conservative

Legacy offers carry no price column; the figure lives inside the HTML blurb,
and some quote several ("$25 now just $12.50!", "$5/week or $15/month"). Any
offer whose price is ambiguous is published at **0**, which renders no price
label at all rather than the wrong one — the checkout page stays authoritative.
Those rows are written to `prisma/legacy-packages-review.json` for a human to
confirm. At the time of writing: 81 confident, 28 with no price in the copy, 13
ambiguous.

### Text encoding

The legacy tables stored UTF-8 through a latin-1/cp1252 column, so emoji come
back mangled (`ðŸ”¥` for 🔥). The extractor repairs this run by run — the
descriptions mix corrupted spans with characters that were stored correctly
(— • –), so re-encoding a whole string always fails on one of the good ones.

## Signing in with the old password

When the export carries each capper's stored credential, they sign in at
`/login` with **their username, the same email, and the password they already
had** — nothing to claim, nothing to reset. When several accounts share one
inbox, the username picks which profile to open.

| Field            | Notes                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| `passwordHash`   | the credential exactly as the old platform stored it                                                     |
| `passwordFormat` | `BCRYPT` \| `PHPASS` \| `MD5` \| `SHA1` \| `SHA256` \| `PLAINTEXT` — detected from the hash when omitted |

The extractor picks the column up automatically (`pass`, `password`, `user_pass`
and friends) and reports what it found; `--password-column` names an odd one,
`--password-format` forces the format, `--no-passwords` skips credentials
entirely. Hashes it can't classify are dropped rather than imported, because a
credential login can't verify is one nobody can sign in with — those cappers
fall back to claiming. `PLAINTEXT` is never auto-detected; declare it.

What happens on that first sign-in (`src/auth.ts`):

1. The submitted password is checked against the imported hash
   (`src/lib/legacy-password.ts` — bcrypt including PHP's `$2y$`, phpass `$P$` /
   `$H$`, and unsalted MD5/SHA-1/SHA-256).
2. On a match it is **re-hashed with bcrypt** into `passwordHash` and the
   imported hash is cleared, so each account passes through that path once.
3. If the password doesn't meet the current requirements (12+ characters), the
   account is flagged (`passwordUpdateRequiredAt`) and the capper gets a one-time
   email. **This never blocks the sign-in** — their password keeps working until
   they change it at `/dashboard/security`, prompted by a banner across the
   capper workspace.
4. Then the current policy gate applies, same as everyone: `/accept-terms`
   before any workspace.

Accounts imported without a credential — and any hash that couldn't be
classified — use the claim routes below instead.

### When passwords were already backfilled in bulk

An account that already holds an SCL password is left alone by default: it
claimed itself or already migrated, and a re-run must not resurrect the old
credential. That default is wrong in one specific case — when passwords were set
**for** cappers in bulk (an operator backfill) rather than chosen by them. Every
account then looks claimed, and the import attaches nothing while reporting
success. The run says so explicitly:

```
  credentials    : 0 attached, 108 skipped (account already has a password)
```

```bash
# Accept the old password *as well as* the one already on the account.
npm run db:import-legacy -- --attach-credentials prisma/legacy-cappers.json
```

Nothing is overwritten. Both credentials work until the capper signs in with
their own, at which point it becomes the account's real password (bcrypt), the
imported hash is cleared, and the operator-set one stops working — verified
end-to-end. Use this only when the current passwords were not chosen by the
cappers themselves; otherwise the default is the safer behaviour.

## Claiming an imported account

An imported `User` with **no `passwordHash`** is unclaimed: the record and public
profile exist, but nobody has ever signed in to it. `emailVerified` says nothing
about this — the importer copies the old platform's verified flag, so a capper
can be both verified and unclaimed.

Three routes turn an unclaimed record into a working login. All of them preserve
the profile, plays, and carried record — none creates a second account:

1. **Forgot password** (`/forgot-password`, also linked from `/login` as "Claim
   your account" and from the public profile). Emails a single-use link that
   sets the first password, verifies the address, and activates the account.
   Needs a real email on the record.
2. **Signup with the imported email** (`/signup`). `signupAction` treats an
   account with no password as claimable and writes the credentials onto the
   existing record, together with a `TermsAcceptance` marked
   `acceptanceSource: "CLAIM"`. A claim never grants privilege — the claimed
   account is always left as `CAPPER`.
3. **Admin-issued claim link** (`/admin/cappers/[id]` → Account Control →
   _Issue claim link_). For the records imported with a placeholder
   `username@legacy.scl` address, which no email can reach: the link is
   generated, not sent, and shown once for an admin to hand over directly.

A handle alone is never proof of ownership — handles are public on the
leaderboard — so signing up with someone else's imported handle and a different
email is refused, with a message pointing at the routes above.

After signing in, a claimed account still has to accept the **current** policy
bundle at `/accept-terms` before reaching any workspace; `requireCapperAccess` /
`requireAdmin` gate on the live bundle version, so a policy revision re-gates
everyone, imported or not.
