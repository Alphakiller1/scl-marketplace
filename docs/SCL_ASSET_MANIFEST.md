# SCL Asset Manifest

Production visual assets live under `public/assets/scl/`. Generated artwork never contains UI
text, metrics, controls, or logos; those remain accessible HTML and code-native components.

Remote sports marks are **self-hosted** (optional) under `public/marks/`, gated by a static
manifest — never hotlinked. Missing marks always render the monogram/lettermark fallback.

| Asset                             |  Dimensions | Use                         | Treatment                                                                                  |
| --------------------------------- | ----------: | --------------------------- | ------------------------------------------------------------------------------------------ |
| `leaderboard-trophy-desktop.webp` | 1920 x 1080 | Home hero at `sm` and above | Exact magenta + cobalt continuous scene (baseline grade); trophy right with crown headroom |
| `leaderboard-trophy-mobile.webp`  | 1080 x 1920 | Home hero below `sm`        | Matching portrait; magenta chart + cobalt atmosphere (same baseline grade)                 |

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
- No third-party logo, interface, text, statistic, athlete, league mark, or sportsbook mark is
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

## Generation prompts

Canonical art direction: **magenta chart/grid + cobalt trophy/ambient** on a continuous dark
data room. Do not regenerate toward sky-blue grades or abandon cobalt metal.

Desktop:

> One continuous dark data room. Magenta/pink neon chart line and perspective grid span the full
> width. Cobalt-blue metallic trophy in the right third with clear margin above the crown. Soft
> cobalt ambient only — not washed sky blue, not flat black left void. No collage, seam,
> text/logos/UI/people/watermark.

Mobile:

> Portrait companion of the same magenta + cobalt continuous scene. Atmosphere fills the upper
> third and edges. Fully visible cobalt-lit trophy with margin above the crown. No collage, seam,
> flat black void, text, logos, UI, people, or watermark.

When owners ask to “lighten the blue,” keep the magenta + cobalt identity. Prefer an owner-
approved art swap or a **tiny** token nudge — never a sky/electric regrade or a broad pixel
lighten pass that washes the scene.
