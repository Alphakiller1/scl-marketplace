# SCL Asset Manifest

Production visual assets live under `public/assets/scl/`. Generated artwork never contains UI
text, metrics, controls, or logos; those remain accessible HTML and code-native components.

Remote sports marks are **self-hosted** (optional) under `public/marks/`, gated by a static
manifest — never hotlinked. Missing marks always render the monogram/lettermark fallback.

| Asset                                      |  Dimensions | Use                                | Treatment                                                                                            |
| ------------------------------------------ | ----------: | ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `leaderboard-hero-atmosphere-desktop.webp` | 2400 x 1200 | Home hero bleed at `sm` and above  | Dense widen of the original `a9f20d3` scene (same design); `object-cover` for edge-to-edge fill      |
| `leaderboard-hero-atmosphere-mobile.webp`  | 1200 x 1600 | Home hero bleed below `sm`         | Portrait companion derived the same way from the original mobile art                                 |
| `leaderboard-trophy-desktop.webp`          | 1920 x 1280 | Home hero trophy at `sm` and above | Opaque original silver trophy + gold crown (`a9f20d3`); `object-contain` — leave framing as-designed |
| `leaderboard-trophy-mobile.webp`           | 1080 x 1920 | Home hero trophy below `sm`        | Opaque matching portrait original                                                                    |

## League / team marks (self-hosted)

| Kind          | Path pattern                              | Gate                        | Fallback                        |
| ------------- | ----------------------------------------- | --------------------------- | ------------------------------- |
| League marks  | `public/marks/leagues/{key}.svg`          | `LEAGUE_MARKS` in manifest  | Deterministic color + initials  |
| Team marks    | `public/marks/teams/{sport}/{abbr}.svg`   | `TEAM_MARKS` (`SPORT:ABBR`) | Deterministic color + abbr      |
| Player images | ESPN headshots (see `src/lib/players.ts`) | **No — deferred**           | Initials slot only when shipped |

To add a mark: drop the SVG into the path above, then add the key to
`src/lib/mark-manifest.ts`. Do not add runtime `fs` checks.

Code maps: `src/lib/mark-manifest.ts`, `src/lib/teams.ts`, `src/lib/leagues.ts`,
`src/lib/players.ts` (slot only).

## Source and rights

- Both trophy files are original AI-generated production artwork created for SCL.
- The owner-provided concept image was used only as visual-direction reference.
- No third-party logo, interface text, statistic, athlete, league mark, or sportsbook mark is
  embedded in either **local** trophy asset.
- League/team SVGs in `public/marks/` must be rights-clear neutral artwork before listing in the
  manifest. Always keep onError → color-mark fallbacks.

## Delivery rules

- Serve the pre-compressed WebP files through responsive art direction.
- Preserve intrinsic dimensions to prevent layout shift.
- Treat both images as decorative with empty alt text; the trophy meaning is conveyed by nearby
  HTML copy.
- Do not place essential information inside either image.
- Do not reuse the artwork as a full-page background on data-heavy routes.
- Team/league `<img>` marks are decorative (`alt=""`); identity is conveyed by adjacent text.
- Hero `<picture>` must be `absolute inset-0` + `object-cover object-center` so the banner
  stretches the full hero width (no padded letterbox canvas, no right-biased crop that leaves a
  void).

## Generation prompts

Canonical art direction: **magenta market chart + cobalt sports ambient** with a **simple solid
trophy + gold crown**. Atmosphere must reach every edge. Trophy stays readable but small (~30% of
frame height) — not a close-up, not ornate filigree.

Desktop:

> Full-bleed 16:9 dark sports-betting banner. Left/center: bold magenta neon odds/market chart
> and soft candlesticks on a dark grid floor. Right: simple solid silver cup trophy with two plain
> handles and a gold crown (~30% of frame height, clear headroom). Cobalt stadium ambient on the
> right mixing with magenta on the left. Atmosphere to all four edges. No text/logos/UI/people.

Mobile:

> Portrait companion, full-bleed. Large atmospheric headroom for copy. Same magenta + cobalt
> language and simple solid trophy + crown, smaller in frame. No text/logos/UI/people.

Cache-bust hero `<picture>` URLs (`?v=…`) whenever these WebPs change so production browsers
do not keep an old asset after deploy.
