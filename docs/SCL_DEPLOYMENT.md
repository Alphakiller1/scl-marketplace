# SCL Deployment

SCL is a Next.js server app (auth, Prisma/Postgres, server actions), so it needs a host that
runs Node — **Vercel** (our chosen platform). GitHub Pages cannot host it (static only).

Once connected, **GitHub shows the live URL**: Vercel comments preview links on PRs and posts
the production deployment under the repo's _Deployments/Environments_, updating on every push to
`main`.

---

## Option A — Vercel native GitHub integration (recommended, ~3 min)

1. Go to **https://vercel.com/new** and sign in **with GitHub**.
2. **Import** `Alphakiller1/scl-marketplace`.
3. Framework preset auto-detects **Next.js**. Leave build/install defaults.
   `vercel.json` runs `prisma migrate deploy` only for Production, then runs
   the normal `next build`. Preview and CI builds never mutate the shared database.
4. Add the **Environment Variables** below, then **Deploy**.
5. After the first deploy, set `AUTH_URL` to the production URL Vercel gives you
   (e.g. `https://scl-marketplace.vercel.app`) and redeploy.
6. Under **Settings → Environment Variables**, enable **Automatically expose System
   Environment Variables**. The live release gate requires `VERCEL_GIT_COMMIT_SHA`
   to prove the production alias is serving the exact merged commit.

That's it — every push to `main` should auto-deploy.

If the live URL stays on an old build after merges, check Vercel → **Settings** → **Git** →
**Production Branch** is `main`, then use **Option B (Deploy Hook)** below. Do not rely on
manually “promoting” deployments.

### Required environment variables (Vercel → Project → Settings → Environment Variables)

| Var                             | Value                                                                                   | Notes                                        |
| ------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------- |
| `DATABASE_URL`                  | Supabase **Transaction pooler** URI, port **6543**, ending `?pgbouncer=true&schema=scl` | Serverless-safe pooled connections           |
| `DIRECT_URL`                    | Supabase **direct** URI, port **5432**, ending `?schema=scl`                            | Used only for migrations                     |
| `AUTH_SECRET`                   | a strong secret (`npx auth secret`)                                                     | required (all environments)                  |
| `AUTH_URL`                      | the deployed origin, e.g. `https://scl-marketplace.vercel.app`                          | **Production only** — leave unset on Preview |
| `AUTH_TRUST_HOST`               | `true`                                                                                  | required for Auth.js on Vercel               |
| `EMAIL_FROM`                    | `SCL <no-reply@sportscappersleaderboard.com>`                                           | must be on SCL's **own** verified domain     |
| `RESEND_API_KEY`                | Resend key from the **SCL-owned** account                                               | dev logs the link instead if unset           |
| `SUPPORT_EMAIL_TO`              | monitored support inbox                                                                 | also the `Reply-To` on capper-facing mail    |
| `ADMIN_NOTIFICATION_EMAIL_TO`   | comma-separated owner mailbox(es)                                                       | signup / affiliate / storefront alerts       |
| `SUPABASE_URL`                  | Supabase project API URL                                                                | **required for avatar/cover uploads**        |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase service-role key                                                               | server only; never expose to the browser     |
| `SUPABASE_PROFILE_MEDIA_BUCKET` | `scl-profile-media`                                                                     | optional bucket-name override                |
| `ODDS_API_KEY`                  | The Odds API key                                                                        | later (odds-assist/grading)                  |
| `CRON_SECRET`                   | strong shared secret                                                                    | required by automatic grading                |
| `SCL_ALLOW_GHOST_PUBLICATION`   | unset or `0`                                                                            | never set to `1` for launch                  |
| `WHOP_WEBHOOK_SECRET`           | Whop signing secret                                                                     | optional while using the manual workflow     |

#### Transactional email ownership

Two independent things decide what a capper sees in their inbox, and only one of them
is visible from the code:

1. **`EMAIL_FROM`** — the from line. `Name <address>` is supported; the name is what an
   inbox renders, so a correct address carrying the wrong company name still reads as a
   phish. `/api/health` reports `email.displayName` alongside `email.domain` for exactly
   this reason — a domain check alone cannot see it.
2. **`RESEND_API_KEY`** — _whose_ Resend account signs, bills, and retains the mail. The
   sending domain must be verified in that account, so the key and the from-domain are
   not independent choices.

**The account must belong to SCL, not to an individual.** Production email that depends
on a personal account can stop without warning — closed account, hit rate limit,
suspended key — and nobody on the SCL side would have visibility or a way in. To move
sending between Resend accounts, use Resend's **Domain Claim** (Domains → Add Domain →
Start claim): it proves ownership with a DNS TXT record and releases the domain from the
old team. A domain with recent sending activity may need Resend support to release it, so
do not schedule this an hour before launch.

After swapping either value, **redeploy** — both are read at module scope in
`src/lib/email.ts`, so an env edit alone does not reach the running deployment.

Every send in `src/lib/email.ts` is deliberately best-effort: it logs and returns
`delivered: false` rather than throwing, so signup never breaks on a mail outage. The
cost is that **a wrong key fails silently**. Verify with a real signup and read the
message headers (`DKIM-Signature: d=` should be SCL's domain), not with a green deploy.

#### Profile media uploads (avatar / cover)

Uploads go through `uploadProfileMediaAction` → Supabase Storage (not Vercel Blob).
If Production is missing the Supabase vars, the UI returns
**"Profile media uploads are not configured yet."** — that is a **config gap**, not a
client bug.

**Automatic sync (recommended):** connect the [Supabase Vercel integration](https://vercel.com/marketplace/supabase).
It pushes `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `POSTGRES_*` vars; SCL accepts those
names as aliases. See `docs/SUPABASE_VERCEL_ENV_SYNC.md`.

**Manual / GitHub sync:** store secrets under GitHub → Environments → **Production**, then
run **Actions → Sync Supabase env to Vercel**. Same doc covers one-time setup.

Set these on **Vercel → Project → Settings → Environment Variables** (Production + Preview)
if you are not using either sync path above:

1. `SUPABASE_URL` — Project Settings → API → Project URL
2. `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API → `service_role` (secret)
3. `SUPABASE_PROFILE_MEDIA_BUCKET` — optional; defaults to `scl-profile-media`

The server creates the public bucket on first upload when the service role can manage
Storage. Confirm Storage is enabled on the Supabase project and the service role is not
restricted from `storage` APIs.

Local `.env` must mirror the same three keys (see `.env.example`).

When adding each var, Vercel shows **Production / Preview / Development** checkboxes — tick
**Production + Preview** for everything **except `AUTH_URL`** (Production only). This keeps
branch/PR preview deploys working as testing environments.

> **Environments.** Vercel auto-creates two: **Production** (deploys from `main`) and
> **Preview** (a fresh URL per branch/PR — your **testing environments**). No separate setup
> needed; Preview URLs surface on each PR in GitHub.

> **Important — use the pooler for `DATABASE_URL` in production.** The direct connection
> (`db.<ref>.supabase.co:5432`) can exhaust connections under serverless load. In Supabase →
> **Connect**, copy the **Transaction** pooler string (port 6543), add
> `?pgbouncer=true&schema=scl`. Keep `DIRECT_URL` on the direct 5432 connection for migrations.
> For a quick first test deploy you may reuse your local direct URL for both, then switch
> `DATABASE_URL` to the pooler before real traffic.

### Migrations

Production Vercel builds run `npm run db:deploy` before `next build`. Ordinary
`npm run build`, CI, and Preview builds do not apply migrations. This prevents
feature branches from changing the shared production schema while ensuring a
merged production release cannot silently lag behind its additive migrations.

Use expand/contract migrations: production deployment may apply a migration
before the new application bundle becomes active, so schema changes must remain
compatible with the currently running version. SCL migrations operate only in
the isolated `scl` schema and must never reference `public`.

---

## Option B — Deploy Hook (simplest GitHub-driven live update)

If merges to `main` do not show up on the live site, use a **Deploy Hook**. No “promote”
step. One URL. Every push to `main` tells Vercel: “rebuild the live site from `main`.”

### One-time setup (~2 minutes)

1. Open the Vercel project → **Settings** → **Git**.
2. Scroll to **Deploy Hooks**.
3. Create a hook:
   - **Name:** `main-live` (any name is fine)
   - **Branch:** `main`
4. Click **Create Hook** and **copy the URL** (looks like
   `https://api.vercel.com/v1/integrations/deploy/...`).
5. In GitHub → **Settings** → **Environments** → **Production** → **Environment secrets**,
   add:
   - Name: `VERCEL_DEPLOY_HOOK_URL`
   - Value: paste that URL
6. Push to `main` (or Actions → **Deploy (Vercel)** → Run workflow). The job POSTs the hook;
   Vercel builds; the live URL updates when the build finishes.

That’s it. You do not need `VERCEL_TOKEN` / org / project IDs if the hook is set.

Once `VERCEL_DEPLOY_HOOK_URL` is saved under Environments → Production, every push to `main` rebuilds the live site automatically.

The deploy workflow does not stop at an accepted hook. It polls `/api/health`
until the production alias reports the exact Git commit being deployed and the
launch schema is ready, then verifies the home, leaderboard, packages,
verification, support, and login routes. A green deploy job therefore means the
live alias changed successfully; it does not merely mean Vercel accepted a build.

### Production owner promotion

The manual **Provision existing production owner** workflow promotes a verified
SCL account to `ADMIN`. Add `OWNER_DATABASE_URL` to GitHub's **Production**
environment secrets before running it. It must be the same production SCL
transaction-pooler URL used by the app (`?pgbouncer=true&schema=scl`), not an
IPv6-only direct Supabase URL and not a connection string from another project.

### Fallback (CLI tokens)

If you prefer not to use a hook, put all three under the same **Production** environment
instead: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (see older Option B notes /
`vercel link`). The workflow uses the hook when present, otherwise the CLI path.

### Important

Vercel **project env vars** (`DATABASE_URL`, `AUTH_SECRET`, …) only configure the running app.
They do **not** trigger builds. Without a working Option A auto-deploy or a Deploy Hook /
CLI secrets, merges to `main` will not change the live site.

<!-- deploy-hook check 2026-07-17T21:45:00Z hero opaque original trophy + original-design bleed -->
