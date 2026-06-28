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
3. Framework preset auto-detects **Next.js**. Leave build/install defaults
   (install runs `prisma generate` via `postinstall`; build is `next build`).
4. Add the **Environment Variables** below, then **Deploy**.
5. After the first deploy, set `AUTH_URL` to the production URL Vercel gives you
   (e.g. `https://scl-marketplace.vercel.app`) and redeploy.

That's it — every push to `main` now auto-deploys and the URL appears in GitHub.

### Required environment variables (Vercel → Project → Settings → Environment Variables)

| Var                             | Value                                                                                   | Notes                                        |
| ------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------- |
| `DATABASE_URL`                  | Supabase **Transaction pooler** URI, port **6543**, ending `?pgbouncer=true&schema=scl` | Serverless-safe pooled connections           |
| `DIRECT_URL`                    | Supabase **direct** URI, port **5432**, ending `?schema=scl`                            | Used only for migrations                     |
| `AUTH_SECRET`                   | a strong secret (`npx auth secret`)                                                     | required (all environments)                  |
| `AUTH_URL`                      | the deployed origin, e.g. `https://scl-marketplace.vercel.app`                          | **Production only** — leave unset on Preview |
| `AUTH_TRUST_HOST`               | `true`                                                                                  | required for Auth.js on Vercel               |
| `EMAIL_FROM`                    | a verified sender, e.g. `no-reply@yourdomain`                                           | optional until email is live                 |
| `RESEND_API_KEY`                | your Resend API key                                                                     | optional; dev logs the link if unset         |
| `SUPABASE_URL`                  | Supabase project API URL                                                                | required for profile media uploads           |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase service-role key                                                               | server only; never expose to the browser     |
| `SUPABASE_PROFILE_MEDIA_BUCKET` | `scl-profile-media`                                                                     | optional bucket-name override                |
| `ODDS_API_KEY`                  | The Odds API key                                                                        | later (odds-assist/grading)                  |

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

The build does **not** run migrations. Apply schema changes from your machine
(`npm run db:migrate`) or a one-off job before/after deploy. The `scl` schema is isolated;
migrations never touch `public`.

---

## Option B — GitHub Actions → Vercel (deploy driven from GitHub)

A guarded workflow at `.github/workflows/deploy.yml` deploys to Vercel on push to `main`. It
**no-ops** until you add three repository secrets, so it won't fail before it's configured.

1. Create the Vercel project once (Option A steps 1–4) to get its IDs.
2. Generate a token at **https://vercel.com/account/tokens**.
3. Add repo secrets (GitHub → Settings → Secrets and variables → Actions):
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID` (from `.vercel/project.json` after `vercel link`, or the team settings)
   - `VERCEL_PROJECT_ID` (same source)
4. Push to `main` → the workflow deploys and prints the URL in the run summary.

> Use **either** Option A **or** Option B, not both (they'd double-deploy). If you use the
> native integration, you can delete `deploy.yml`.
