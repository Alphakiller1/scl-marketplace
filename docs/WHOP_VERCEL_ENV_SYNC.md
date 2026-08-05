# Whop → Vercel env sync (GitHub Actions)

Use this when you want **agents or CI** to push Whop credentials into Vercel without
pasting them in the Vercel UI each time. Secrets live in **GitHub**; the workflow copies
them to **Vercel Production** and optionally redeploys.

---

## What you are building

```
GitHub Production environment secrets
        │
        ▼
  Sync Whop env to Vercel  (manual workflow)
        │
        ├── vercel env add … (Production)
        └── POST deploy hook → rebuild live site
```

After setup, an owner (or cloud agent with workflow dispatch access) runs **Actions →
Sync Whop env to Vercel → Run workflow** whenever Whop keys rotate.

---

## Step 1 — Create a Vercel access token

1. Open **[vercel.com/account/tokens](https://vercel.com/account/tokens)** (or Avatar →
   **Account Settings** → **Tokens**).
2. **Create Token**
   - Name: `github-scl-whop-sync`
   - Scope: **Full Account** (or a custom token with access to the `scl-marketplace`
     project and env-var write — Full Account is simplest for a solo owner)
3. **Copy the token** — shown once.

---

## Step 2 — Find your Vercel org id and project id

### Org / team id (`VERCEL_ORG_ID`)

1. Vercel dashboard → **Settings** → **General** (team settings if you use a team).
2. Copy **Team ID** (starts with `team_…`) or your personal scope slug.

For CLI/API, the **team slug** or **team id** works as `--scope`. The workflow uses
whatever you store in `VERCEL_ORG_ID`.

### Project id (`VERCEL_PROJECT_ID`)

1. Open the **scl-marketplace** project.
2. **Settings** → **General** → **Project ID** (`prj_…`).

---

## Step 3 — Add GitHub Production environment secrets

1. GitHub → **Alphakiller1/scl-marketplace** → **Settings** → **Environments** →
   **Production**.
2. Under **Environment secrets**, add:

| Secret                    | Required       | Purpose                                                     |
| ------------------------- | -------------- | ----------------------------------------------------------- |
| `VERCEL_TOKEN`            | **Yes**        | Token from Step 1                                           |
| `VERCEL_ORG_ID`           | **Yes**        | Team id or slug from Step 2                                 |
| `VERCEL_PROJECT_ID`       | **Yes**        | `prj_…` from Step 2                                         |
| `VERCEL_DEPLOY_HOOK_URL`  | Recommended    | Redeploy after sync (see `docs/SCL_DEPLOYMENT.md` Option B) |
| `WHOP_WEBHOOK_SECRET`     | Whop           | `ws_…`                                                      |
| `WHOP_API_KEY`            | Whop           | Account API key (`apik_…`)                                  |
| `WHOP_APP_API_KEY`        | **Whop OAuth** | App API key — required for capper install flow              |
| `NEXT_PUBLIC_WHOP_APP_ID` | Optional       | Defaults to `app_I5rsiJlsDgRe5O` in code                    |
| `WHOP_APP_ID`             | Optional       | Alias for app id (server-only)                              |
| `WHOP_AFFILIATE_USERNAME` | Optional       | Defaults to `SportsCappersLeaderboard` in code              |

Only add Whop secrets you want synced; empty secrets are skipped.

> **Do not** add these under repository secrets unless you also attach that environment
> to the workflow. This repo expects them on the **Production** environment (same as
> `Deploy (Vercel)`).

---

## Step 4 — Run the sync workflow

1. GitHub → **Actions** → **Sync Whop env to Vercel**.
2. **Run workflow** → branch `main` → leave **Redeploy** checked.
3. Wait for green. Open the job summary — it lists which keys were upserted.

Verify live:

```bash
curl -s https://sportscappersleaderboard.com/api/health | jq .whop
```

Expect `"oauth": true` and `"storefrontSync": true` once `WHOP_APP_API_KEY` synced and
the redeploy finished.

---

## Step 5 — Tell agents they can use this path

Once Steps 1–3 are done, cloud agents **cannot** call the Vercel API directly, but they
can ask you to run the workflow — or, if your agent integration gains
`workflow_dispatch` permission, it can trigger **Sync Whop env to Vercel** after you
store rotated Whop keys in GitHub Production secrets.

Manual Vercel UI paste is still fine for a one-off; this path is for repeatability and
agent-friendly ops.

---

## Troubleshooting

| Symptom                                    | Fix                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| Workflow fails “Missing VERCEL\_\*”        | Add all three Vercel CLI secrets to **Production** environment           |
| Sync succeeds but `whop.oauth` still false | Redeploy Production (hook or Vercel dashboard → Redeploy)                |
| `invalid_client` on OAuth callback         | `WHOP_APP_API_KEY` must be the **App** key, not the Account key          |
| Agent cannot run workflow (403)            | Run it yourself from Actions tab; or grant the integration Actions write |

See also `docs/WHOP_API_SETUP_OWNER_GUIDE.md` for Whop dashboard setup (webhook URL,
OAuth redirect, events).
