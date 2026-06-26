# SCL Component System

SCL-native components live in `src/components/scl/`. They compose shadcn primitives
(`src/components/ui/`) into the SCL design language. **Build features from these, not raw
shadcn.** Every new product surface should reuse or extend this set.

## Primitives — stats (`stat.tsx`)

Numbers are the product. These render performance consistently everywhere.

- `StatBlock` — big tabular value + uppercase label (+ optional sub). Core stat unit.
- `StatPill` — compact inline labeled stat for dense rows.
- `RoiStat`, `UnitStat`, `WinRateStat`, `RecordStat` — domain stats, auto sign-toned
  (pos/neg) via `signTone`. `variant="block" | "pill"`.

## Badges & status (`badges.tsx`)

- `VerificationBadge` — verified record marker (live/cyan). Sizes `xs|sm|md`.
- `TrophyBadge` — gold award/status chip.
- `SportTag` — uppercase sport label from the canonical taxonomy.
- `StatusBadge` — pick status (`pending|live|win|loss|push|void`); `live` animates a ping dot.

## Indicators (`indicators.tsx`)

- `RankMovementIndicator` — up/down/flat vs previous period.
- `RecentFormStrip` — W/L/P pips, most recent on the right.
- `StreakChip` — hot/cold streak.

## Identity (`capper-avatar.tsx`)

- `CapperAvatar` — rounded-xl avatar with initials fallback. Sizes `sm|md|lg|xl`.

## Composite

- `LeaderboardRow` (`leaderboard-row.tsx`) — desktop leaderboard row (grid, hover, links).
- `LeaderboardMobileCard` — mobile card equivalent (never a compressed table).
- `CapperCard` (`capper-card.tsx`) — discovery/résumé card.
- `PickCard` (`pick-card.tsx`) — today's-pick card (event, selection, odds, stake, capper, status).
- `SectionHeader` (`section.tsx`) — titled section with optional "view all".

## States (`states.tsx`)

- `EmptyState` — icon + title + description + action.
- `SkeletonCard`, `SkeletonTable` — loading placeholders matching real layout.

## Still to build (Phase 1 roadmap)

`CapperProfileHeader`, `PerformanceSummary`, `ProfilePerformanceChart` (Recharts),
`FilterChip` / `TimeWindowFilter` / `SortToggle`, `GameCard`, `MobileBottomNav`,
`DesktopSidebar`, `AdminGradePanel`, `ShareableProfileCard`, `ShareablePickCard`,
`Leaderboard` (filtering container), `TrophyCase`.

## Authoring rules

- Server Components by default; `"use client"` only for interactivity.
- Props are typed and minimal; derive display strings via `src/lib/format.ts`.
- Tokens only (see Design Contract). Mobile-first. a11y by default.
- No business logic in components — compute in `src/lib`, pass data in.
