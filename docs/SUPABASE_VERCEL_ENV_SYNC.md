# Supabase → Vercel env sync

SCL needs Supabase credentials on Vercel for **database access** and **profile image
uploads**. There are two ways to keep those variables in sync.

---

## Option A — Supabase Vercel integration (automatic, recommended)

The official [Supabase for Vercel](https://vercel.com/marketplace/supabase) integration
syncs project env vars whenever you connect or branch preview deployments.

1. Vercel → **Marketplace** → **Supabase** → connect your existing Supabase project (or
   create one through Vercel).
2. Link it to the **scl-marketplace** Vercel project.
3. Confirm **Production** and **Preview** scopes are enabled for the synced variables.

The integration installs names like `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and
`POSTGRES_*`. SCL accepts those aliases automatically:

| Supabase integration var               | SCL usage                                               |
| -------------------------------------- | ------------------------------------------------------- |
| `SUPABASE_URL`                         | Profile media Storage API                               |
| `NEXT_PUBLIC_SUPABASE_URL`             | Alias for `SUPABASE_URL`                                |
| `SUPABASE_SECRET_KEY`                  | Alias for `SUPABASE_SERVICE_ROLE_KEY` (Storage uploads) |
| `POSTGRES_PRISMA_URL` / `POSTGRES_URL` | Alias for `DATABASE_URL` (adds `schema=scl`)            |
| `POSTGRES_URL_NON_POOLING`             | Alias for `DIRECT_URL` (adds `schema=scl`)              |

After connecting, redeploy Production once. Verify:

```bash
curl -s https://sportscappersleaderboard.com/api/health | jq .supabase
```

Expect `"storage": true` once the service role key and project URL are present.

> **Preview branches:** Supabase also syncs vars when a PR opens. See
> [Supabase branching + Vercel](https://supabase.com/docs/guides/deployment/branching/integrations).

---

## Option B — GitHub Actions sync (manual trigger)

Use this when you prefer to store Supabase secrets in **GitHub** and push them to Vercel
on demand — same pattern as Whop (`docs/WHOP_VERCEL_ENV_SYNC.md`).

```
GitHub Production environment secrets
        │
        ▼
  Sync Supabase env to Vercel  (manual workflow)
        │
        ├── vercel env add … (Production)
        └── POST deploy hook → rebuild live site
```

### One-time setup

1. Complete **Step 1–2** in `docs/WHOP_VERCEL_ENV_SYNC.md` (Vercel token, org id,
   project id — you can reuse the same three secrets).
2. GitHub → **Settings** → **Environments** → **Production** → add:

| Secret                          | Required          | Source (Supabase dashboard)                      |
| ------------------------------- | ----------------- | ------------------------------------------------ |
| `VERCEL_TOKEN`                  | Yes               | Same as Whop sync                                |
| `VERCEL_ORG_ID`                 | Yes               | Same as Whop sync                                |
| `VERCEL_PROJECT_ID`             | Yes               | Same as Whop sync                                |
| `VERCEL_DEPLOY_HOOK_URL`        | Recommended       | `docs/SCL_DEPLOYMENT.md` Option B                |
| `SUPABASE_URL`                  | **Yes** (uploads) | Project Settings → API → Project URL             |
| `SUPABASE_SERVICE_ROLE_KEY`     | **Yes** (uploads) | Project Settings → API → `service_role` secret   |
| `SUPABASE_PROFILE_MEDIA_BUCKET` | Optional          | Defaults to `scl-profile-media`                  |
| `DATABASE_URL`                  | Optional          | Transaction pooler, `?pgbouncer=true&schema=scl` |
| `DIRECT_URL`                    | Optional          | Direct connection, `?schema=scl`                 |

Only secrets that exist in GitHub are pushed; empty values are skipped.

### Run the sync

1. GitHub → **Actions** → **Sync Supabase env to Vercel**.
2. **Run workflow** → branch `main` → leave **Redeploy** checked.
3. Wait for green, then verify:

```bash
curl -s https://sportscappersleaderboard.com/api/health | jq .supabase
```

---

## Which option should I use?

| Situation                                     | Use                                                           |
| --------------------------------------------- | ------------------------------------------------------------- |
| New setup, want automatic preview + prod sync | **Option A** (Vercel integration)                             |
| Already store secrets in GitHub Production    | **Option B** (Actions workflow)                               |
| Rotated the service role key                  | Re-run Option B, or update in Vercel UI                       |
| Profile uploads say "not configured yet"      | Check `/api/health` → `supabase.storage`; fix missing URL/key |

Both options can coexist. If the Vercel integration already sets `SUPABASE_SECRET_KEY`,
you do **not** need to duplicate it as `SUPABASE_SERVICE_ROLE_KEY` — SCL reads both.

---

## Troubleshooting

| Symptom                                    | Fix                                                                    |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| `supabase.storage: false` on `/api/health` | Add `SUPABASE_URL` + service role key via Option A or B, then redeploy |
| Database works but uploads fail            | Service role key missing or Storage disabled on Supabase project       |
| Integration synced but uploads still fail  | Confirm `SUPABASE_SECRET_KEY` is present (SCL accepts it as alias)     |
| Workflow fails "Missing VERCEL\_\*"        | Add Vercel CLI secrets to GitHub **Production** environment            |
| Sync succeeds but health unchanged         | Redeploy Production (hook or Vercel dashboard)                         |

See also `docs/SCL_DEPLOYMENT.md` for pooler vs direct database URLs and migration notes.
