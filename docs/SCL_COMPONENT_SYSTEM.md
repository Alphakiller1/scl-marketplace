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

- `VerificationBadge` — verified record marker (Settlement Gold). Sizes `xs|sm|md`.
- `TrophyBadge` — gold award/status chip.
- `SportTag` — uppercase sport label from the canonical taxonomy.
- `StatusBadge` — pick status (`pending|live|win|loss|push|void`); `live` animates a ping dot.
- `Ticket` (`ticket.tsx`) — signature bet-ticket receipt (tear line, gold stamp, mono capture).
  Used on post-submit verification and the landing hero settling sequence.

## Indicators (`indicators.tsx`)

- `RankMovementIndicator` — up/down/flat vs previous period.
- `RecentFormStrip` — W/L/P pips, most recent on the right.
- `StreakChip` — hot/cold streak.
- `RankBadge` (`rank-badge.tsx`) — stable podium treatment for first through third and numeric
  treatment for the remaining field.
- `PerformanceSparkline` (`performance-sparkline.tsx`) — real cumulative-unit trend with
  sign-aware tone and an accessible label.

## Identity (`capper-avatar.tsx`)

- `CapperAvatar` — rounded-xl avatar with initials fallback. Sizes `sm|md|lg|xl`.
- `ProfileMediaEditor` — authenticated avatar and cover uploader with validated image states.
- `ProfileIdentityPreview` — live preview of the identity published across SCL.
- `StorefrontPreview` — live preview of the capper-controlled default storefront identity.
- `ProfileTagInput` — compact, keyboard-friendly specialty editor.

## Onboarding (`onboarding-progress.tsx`, `profile-completion.tsx`)

- `OnboardingProgress` — account, email verification, and public-profile status.
- `ProfileCompletionPanel` — data-derived identity strength and missing-signal checklist.
- `AccountTrustSummary` / `AccountStatusBadge` — account lifecycle, verification, policy, and access standing.
- `AccountStatusControl` — audited admin lifecycle control for capper accounts.

## Authentication (`auth-header.tsx`, `password-field.tsx`)

- `AuthHeader` — consistent icon, state label, title, and supporting copy for account flows.
- `AuthStatusNotice` — success, error, and informational account states.
- `AuthFormSkeleton` — loading shell for runtime-dependent auth forms.
- `PasswordField` — labelled password input with accessible visibility control.
- Shared `SclLogo` from the brand foundation is composed across account surfaces, never
  redefined inside the feature component system.

## Composite

- `MobileSiteNav` / `MobileAppNav` (`mobile-navigation.tsx`) — sheet-based phone navigation
  with 44px targets, preserved SCL identity, and safe-area-aware actions.
- `LeaderboardRow` (`leaderboard-row.tsx`) — desktop leaderboard row (grid, hover, links).
- `LeaderboardMobileCard` — mobile card equivalent (never a compressed table).
- `CompactCapperRow` — homepage résumé row with one emphasized ranking metric and inline sample
  context; keeps high-volume home sections scan-efficient without weakening dedicated views.
- `CapperCard` (`capper-card.tsx`) — discovery/résumé card.
- `PickCard` (`pick-card.tsx`) — today's-pick card (event, selection, odds, stake, capper, status).
- `SectionHeader` (`section.tsx`) — titled section with optional "view all".
- `CapperProfileHeader` — cover-led public identity, trust, specialties, socials, and profile actions.
- `CapperStorefront` — public storefront identity, third-party commerce disclosure, and honest
  pre-package empty state.
- `PerformanceSummary` — record, win rate, units, ROI, streak, and recent form.
- `PerformanceScoreboard` — dashboard-grade record, sample, pending count, and cumulative trend.
- `Leaderboard` — shared desktop row / mobile card renderer with honest empty and error states.
- `LeaderboardFilters` — URL-driven sport, window, sort, sample, search, and verification scope.
- `LeaderboardOverview` — data-route title and real aggregate metric band.
- `CompetitionHero` — responsive artwork-led home hero with live platform metrics.

## States (`states.tsx`)

- `EmptyState` — icon + title + description + action.
- `SkeletonCard`, `SkeletonTable` — loading placeholders matching real layout.

## Still to build (Phase 1 roadmap)

`ProfilePerformanceChart` (Recharts), `GameCard`, `MobileBottomNav`, `DesktopSidebar`,
`AdminGradePanel`, `ShareableProfileCard`, `ShareablePickCard`, `TrophyCase`.

## Authoring rules

- Server Components by default; `"use client"` only for interactivity.
- Props are typed and minimal; derive display strings via `src/lib/format.ts`.
- Tokens only (see Design Contract). Mobile-first. a11y by default.
- No business logic in components — compute in `src/lib`, pass data in.
