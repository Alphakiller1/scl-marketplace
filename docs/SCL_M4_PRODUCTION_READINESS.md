# SCL M4 — Production Readiness & Launch

**Status:** active milestone. Distinct from `SCL_M4_PICK_REDESIGN.md` (that doc's internal PR
numbering is unrelated to this delivery milestone; the pick redesign and M5 unified slip are
already shipped). This is the **launch** milestone.

## Scope (as agreed)

1. Public leaderboard improvements
2. Public capper profile pages
3. Mobile responsiveness
4. Legacy capper + historical data migration, where reasonably feasible
5. Final QA and bug fixes
6. Production deployment assistance
7. Delivery of a production-ready Phase 1 platform substantially consistent with Phase 1 scope

## Deliverable status

| #   | Deliverable              | State                    | Notes                                                                                                                                                                                                                                                                                           |
| --- | ------------------------ | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Public leaderboard       | partial                  | Scored 76 in `VISUAL_MATRIX_AUDIT.md`. Stat tiles removed (#315), filter bar tightened (#316). Open: identity cell is `@handle` only (no display name + specialty), sample-maturity bars are faint hairlines, letter avatars.                                                                   |
| 2   | Public capper profiles   | partial                  | Scored 78. Player-prop headshots now real (#329/#331). Open: cumulative-units chart sits behind the Analyst tab (should lead), no CLV in the default stat row, letter avatars on identity.                                                                                                      |
| 3   | Mobile responsiveness    | **in progress**          | Never systematically captured before this milestone. First 375px pass already found and fixed odds-label truncation (#333). Full sweep across public + capper surfaces is the current task.                                                                                                     |
| 4   | Legacy data migration    | not started              | Needs the owner to identify the source of legacy capper records (platform export, CSV, screenshots). No import path exists yet; feasibility depends entirely on source fidelity — SCL's premise is verified records, so imported history must be labelled distinctly from board-verified picks. |
| 5   | Final QA + bug fixes     | ongoing                  | `LAUNCH_READINESS_AUDIT.md` is green on routes/links/perf/SEO/gates. Outstanding: axe/a11y pass on populated states, light-theme sweep.                                                                                                                                                         |
| 6   | Deployment assistance    | mostly done              | Auto-deploy via `deploy.yml` + Vercel git integration; DB pool exhaustion and migration drift resolved; `db-patch` + `reseed-ghosts` workflows exist. Open: Vercel Hobby throttles production promotes under heavy merging — Pro recommended.                                                   |
| 7   | Phase 1 ready for launch | blocked on 3 owner items | See below.                                                                                                                                                                                                                                                                                      |

## Launch blockers (owner-owned, from `LAUNCH_READINESS_AUDIT.md`)

1. **Wipe the 30 fabricated ghost cappers** before real traffic — a "verified records" board must
   not carry invented ones. One `reseed-ghosts.yml` dispatch with `{wipeOnly:true}`.
2. ~~**Rotate default admin credentials**~~ — RESOLVED 2026-08-01. The seed admin was found live and ACTIVE in production with the seed password still working. It is now DISABLED, `ensure-owner-admin` disables any `@scl.local` account on every production deploy, and the credential is out of the docs.
3. **Rotate the prod DB password** — shared in plaintext during development.

## Method note

Auth-gated surfaces are verified with Playwright against local dev using the seed logins, and
public surfaces against production. Screenshots at **375px and 1280px, dark and light**. This is
how #333 (mobile truncation) was caught — code review alone had passed it.
