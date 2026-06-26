# SCL Mobile-First Rules

Most users experience SCL on mobile. Design the phone first, then enhance up. Never just
compress the desktop table.

## Process

1. Build and review the **375px** layout first.
2. Enhance with `sm:` / `md:` / `lg:`. Desktop is the enhancement, not the source of truth.
3. Verify: no horizontal overflow, no clipped content, no tiny text.

## Patterns

- **Tables → cards on mobile.** Use `hidden md:block` for the desktop table and `md:hidden`
  for the card list (see `LeaderboardRow` vs `LeaderboardMobileCard`).
- **Bottom navigation** for primary app nav on mobile (`MobileBottomNav`, to build).
- **Horizontal filter chips** (scrollable) for sport/time/sort filters.
- **Sticky action buttons** for primary CTAs (follow, submit pick).
- **Large touch targets** (≥ 40px), generous spacing, fast scanning.
- Status via badges, not color alone.

## Don'ts

- No compressed/scrolling desktop tables on phones.
- No overloaded rows; show the 3–4 stats that matter, link out for the rest.
- No tiny labels or sub-12px body text.
- No hover-only affordances (touch has no hover).

## Typography on mobile

Keep stat values bold and tabular; keep labels uppercase/tracked but legible. Prioritize
rank, name, and the headline stat (units or ROI) per the current view.
