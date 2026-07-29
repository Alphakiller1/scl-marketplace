# SCL — Visual Matrix & Platform Audit

**Target:** https://scl-marketplace.vercel.app · **Build:** main `8322ca4` · **State:** populated (30 seeded ghost cappers) · **Method:** 5 populated desktop surfaces @ 1280px dark + live HTTP signals. Scores are design-fidelity judgments vs the three supplied concept mockups (homepage / leaderboard / profile) and SCL's v2 design law ("The Ledger & The Board"), not automated metrics.

> **One-line read:** The design system is real and the data now populates, so the gap is **polish + one structural call on the homepage**, not a rebuild. Two things move the needle most: the homepage is a _marketing hero_ where the mockup is an _evidence dashboard_, and _letter-placeholder avatars_ undercut every table. One real perf drag (homepage TTFB ~3.5s). Nothing is broken.

---

## Visual matrix (surface × axis, 0–100)

| Surface         | Mockup fidelity | Composition | Typography | Color & design-law | Data realism | Imagery / avatars | Component polish | **Overall** |
| --------------- | :-------------: | :---------: | :--------: | :----------------: | :----------: | :---------------: | :--------------: | :---------: |
| **Homepage**    |       45        |     70      |     80     |         85         |      88      |        40         |        65        |   **62**    |
| **Leaderboard** |       75        |     82      |     85     |         88         |      90      |        40         |        72        |   **76**    |
| **Profile**     |       72        |     88      |     85     |         90         |      88      |        42         |        82        |   **78**    |
| **Discover**    |       80        |     85      |     84     |         88         |      90      |        45         |        80        |   **79**    |
| **Packages**    |       78        |     80      |     82     |         85         |      85      |        50         |        78        |   **77**    |

Scale: **85–100** matches intent · **70–84** right bones, needs polish · **<70** materially off.

**Read of the matrix:** _Data realism_ is the strongest column (populating prod paid off). The two weak columns cut across every surface — **Imagery/avatars** (letter circles everywhere) and, on the homepage only, **Mockup fidelity**. Fix those two and the whole product jumps a tier.

---

## Per-surface findings

### Homepage — 62 (weakest) · vs mockup #1 (data hero + floating receipt)

- ✅ Data is live — top-5 board, ticker, featured proof all populate honestly.
- ❌ **Wrong hero concept.** Trophy carousel where the mockup is a clean "live verified performance" table + headline on the left.
- ❌ **No floating proof receipt** — the mockup's signature skewed-paper flourish is absent.
- ❌ "Top cappers" renders as a plain `<ul>` list, not the mockup's ranked **table** with a 7D/30D/90D/ALL toggle + per-row sparklines.
- · Featured-proof panel is close; needs a styling pass, not a rebuild.

### Leaderboard — 76 (closest match) · vs mockup #2

- ✅ Correct columns, form dots, verified meters, "Building a record" split, compare tray.
- ✅ Filter bar already carries the mockup's "Ranking scope" + removable-chips language.
- ❌ **Letter avatars** where the mockup has real marks — reads unfinished.
- ❌ **Capper cell too thin** — `@handle` only; mockup stacks _display name + handle + "NBA · Player Props"_.
- ❌ Sample-maturity bars are faint hairlines; mockup uses **bold labeled color bars** (Established / Developing / Early).
- · Four stat tiles above the table read as clutter vs the mockup's clean top.

### Profile — 78 · vs mockup #3 (StatEdge analyst view)

- ✅ Evidence Brief, paper receipt, proof history, marketplace band, verified share — all present and clean.
- ✅ Stake renders correctly (no 0U); receipt is documentary and dominant.
- ❌ **The cumulative-units chart is hidden behind the "Analyst" tab.** The mockup opens on it — it's the profile's most convincing element.
- ❌ Letter avatar again; no CLV stat in the default (Simple) stat row.
- · "Latest proof" can surface a live/ungraded play (em-dash CLV) instead of a settled WON receipt.

### Discover — 79 · no direct mockup, strong surface

- ✅ All five lanes populate; the honest empty-index behavior is correct when thin.
- ✅ Lane primary metrics (long-term ROI, 30d ROI, specialty, verified share, CLV) read clearly.
- ❌ Avatars + dense shelf rows would benefit from the same identity-cell + imagery upgrade.
- · Browse-all grid is good; card rhythm can tighten.

### Packages — 77 · no direct mockup, marketplace

- ✅ Full inventory, both providers (Whop / Winible), promo + price + third-party disclosure.
- ✅ "How packages work" explainer reinforces the record-first / pay-off-platform model.
- ❌ Cards lead with **title over seller identity + record maturity** — inverts the trust order the product argues for.
- · Provider-badge / price hierarchy can be more premium.

---

## Platform audit (beyond the pixels)

- **Performance — P1.** Homepage TTFB is **~3.5s warm**. `src/app/(marketing)/page.tsx` awaits ~6 DB aggregations **in series** (`getLeaderboardResult`, `getLeagueActionReport`, `getYesterdaysGradedWins`, `getTodaysGradedMoves`, `getFeaturedGradedPlay`, `getPlatformClvSummary`). Leaderboard/profile are fast (~0.2s). With 1,336 plays to aggregate, the serial pattern is the drag. **Fix:** `Promise.all` the six; cache the heavy aggregates; keep the ISR window. Likely 3–4× TTFB win.
- **Trust & data honesty — P1.** Prod currently shows **30 fabricated demo cappers on a "verified records" board**. Intentional/reversible (all tagged `@ghost.scl.demo`), but must be wiped or clearly flagged before real traffic or it undercuts the product's premise. Verified-tier semantics themselves are sound.
- **Design-system consistency — P1.** **Avatars are the single biggest cross-surface weakness** — letter circles on leaderboard, top cappers, discover, and profiles. Ship real images or a deterministic monogram treatment. Also unresolved: the mockups show a **"$handle" dollar column** that contradicts the live "units, never dollars" law — a decision, not a bug.
- **Information architecture — OK.** Nav coherent; auth gates correctly (`/dashboard → 307`); SEO/OG metadata present; viewport mobile-ready. **Flag:** confirm `/picks` surfaces recent ghost picks (a quick live scan didn't clearly show them).
- **Accessibility — OK\*.** CI enforces WCAG-AA text contrast + a no-hype copy guard; focus states exist. **\*Not re-audited on the newly populated states** — colored ROI/CLV numbers at scale, meter labels, receipt paper on cream should be re-checked with axe against real rows.
- **Not inspected.** Desktop-1280/dark only, 5 public surfaces. **Mobile (375/390), light theme, New-Pick flow, signup/login, capper dashboard** were not captured — they need their own pass before sign-off.

---

## Prioritized suggestions

| #   | Recommendation                                                                                                                                                                                                                                             | Surface            | Impact       | Effort | Priority |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------ | ------ | -------- |
| 1   | **Replace letter avatars with images or a deterministic monogram system** — one component, every table + profile benefits                                                                                                                                  | All                | Very high    | Low    | **P1**   |
| 2   | **Parallelize homepage data + cache aggregates** (`Promise.all` the 6 queries) — cuts TTFB ~3.5s → ~1s                                                                                                                                                     | Home               | High         | Low    | **P1**   |
| 3   | **Rebuild the homepage below the trophy banner into the evidence dashboard** — slim trophy to a banner (keep CTAs), promote the live-performance table, build the floating receipt, convert top-cappers to the ranked table w/ 7/30/90 toggle + sparklines | Home               | Very high    | Med    | **P1**   |
| 4   | **Enrich the shared leaderboard table** — bolder labeled sample-maturity bars, richer capper cell (name + handle + specialty), drop the 4 stat tiles. Fixes leaderboard page + homepage snapshot at once                                                   | Leaderboard        | High         | Med    | **P1**   |
| 5   | **Wipe or flag ghost cappers before launch** — remove by `@ghost.scl.demo` or flip `isTest`                                                                                                                                                                | Platform           | High (trust) | Low    | **P1**   |
| 6   | **Default the profile to the Analyst cumulative-units view** — lead with equity curve + drawdown/win-rate + CLV                                                                                                                                            | Profile            | Med-high     | Low    | **P2**   |
| 7   | **Decide the "$handle" dollar column** — recommend keep units-only and drop it (reconcile mockup to law, not reverse)                                                                                                                                      | Leaderboard / Home | Med          | Low    | **P2**   |
| 8   | **Re-order package cards to lead with seller + record maturity** above title/price                                                                                                                                                                         | Packages           | Med          | Low    | **P2**   |
| 9   | **Run the un-inspected pass** — mobile 375/390, light theme, New-Pick, signup, dashboard                                                                                                                                                                   | Platform           | Med          | Med    | **P2**   |

**Fastest wins (impact ÷ effort):** #1 monogram avatars, #2 parallelize homepage. **Biggest single visual win:** #3 homepage evidence dashboard. **Do not defer:** #5 (trust) before any real launch.

---

## Key component/file map (for the implementing agent)

- Landing composition: `src/app/(marketing)/page.tsx`
- Trophy banner: `src/components/scl/competition-hero.tsx` (keep slide copy/CTAs verbatim)
- Home evidence grid: `src/components/scl/home-live-board.tsx` (`HomeEvidenceField`)
- Shared table (drives leaderboard page + homepage snapshot): `src/components/scl/leaderboard.tsx`
- Homepage tables: `leaderboard-snapshot.tsx`, `top-cappers-live.tsx`
- Receipts: `featured-proof-receipt.tsx`, `proof-receipt.tsx` (reuse for the floating element)
- Avatars: `src/components/scl/capper-avatar.tsx` (letter fallback lives here)
- Data: `src/lib/queries/leaderboard.ts` — `CapperSummary` already carries `performanceTrend` (sparklines), `avgClv`, `verifiedShare`, `recentForm`, `record`, `roi`, `units`, `settledPicks`. Missing for the mockup tables: avg-odds (computable), real avatar images.

_Design law reference: `design/SCL-DESIGN-SPEC.md`. No code was changed to produce this audit._
