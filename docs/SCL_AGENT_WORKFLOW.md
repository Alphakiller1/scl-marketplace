# SCL Agent Workflow

How Claude Code and Cursor build SCL consistently. Read with `AGENTS.md` and the
`.cursor/rules/`. Tools serve the product — don't add anything trendy that doesn't.

## The build loop

1. Pick a feature (planning workspace `_prompts/` + command center).
2. Branch `feat/…` (never touch `main` directly).
3. Read the relevant docs + existing `src/components/scl/*` before writing code.
4. Build from SCL-native components; tokens only; mobile-first; all states.
5. `npm run typecheck && lint && format && build` green.
6. Add/adjust Playwright coverage for any core flow touched.
7. Open PR → CI (GitHub Actions) + CodeRabbit + Cursor Bugbot review → address feedback.
8. Run the **SCL UI Quality Checklist**. Merge when green.

## Quality gates (already wired)

- **GitHub Actions CI** — format-check, lint, typecheck, build on PRs/pushes to `main`.
- **Husky + lint-staged** — pre-commit eslint/prettier.
- **Cursor Bugbot** — automated PR review (connected).

## Quality gates to add (this stack)

- **CodeRabbit** — mandatory PR review layer (`.coderabbit.yaml`). Needs repo install by owner.
- **Playwright** — e2e for: homepage, leaderboard filters, today's picks, capper profile,
  mobile nav, admin grading. `tests/e2e/`.
- **PostHog** — product analytics: leaderboard views, profile clicks, pick views, follow
  clicks, join clicks, filter usage. Env-gated; no PII beyond necessity.
- **Sentry** — frontend/backend error capture post-launch. Env-gated.

## MCP servers (configure in Claude/Cursor — most need owner accounts/keys)

Recommended, each with a job. **Do not install blindly; each must earn its place.**

- **Context7 MCP** — current docs for Next 16 / Base UI / Prisma so agents don't hallucinate
  outdated APIs. _Highest value here given Next 16 + Auth.js v5 + Prisma churn._
- **Supabase MCP** — DB schema/context for the `scl` schema.
- **Vercel MCP** — deployment/project context.
- **Sentry MCP** — production debugging once Sentry is live.
- **Figma MCP** — translate finalized designs to code accurately.
- **21st.dev Magic MCP** — accelerate component exploration, but **every output must be
  converted to SCL-native design language** (tokens + `src/components/scl`). Never ship raw.
- **Playwright tooling** — UI verification of real flows.

These require the owner to provision accounts/keys; Claude/Cursor cannot self-provision paid
SaaS. Track setup in the planning workspace.

## Research-only tools (never production dependencies)

Competitor/design/social research only (Mobbin, scraping/`Scrapeless`, Agent Reach,
Last30Days-style tools). **Never** use scraping as the foundation for odds, scores, sportsbook
data, or user records — official APIs or internal SCL data only.

## Design-quality references

Apply "Taste"/"Impeccable Design" review standards and Emil-Kowalski-style restrained motion
to avoid generic AI-frontend output. If a screen looks like a default shadcn/SaaS template, it
fails the Design Contract.
