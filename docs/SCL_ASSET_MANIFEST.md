# SCL Asset Manifest

Production visual assets live under `public/assets/scl/`. Generated artwork never contains UI
text, metrics, controls, or logos; those remain accessible HTML and code-native components.

Remote sports marks are **self-hosted** (optional) under `public/marks/`, gated by a static
manifest — never hotlinked. Missing marks always render the monogram/lettermark fallback.

| Asset                             |  Dimensions | Use                         | Treatment                                                                                    |
| --------------------------------- | ----------: | --------------------------- | -------------------------------------------------------------------------------------------- |
| `leaderboard-trophy-desktop.webp` | 1920 x 1080 | Home hero at `sm` and above | One continuous magenta data-space; trophy right with crown headroom; no collage / dual-scale |
| `leaderboard-trophy-mobile.webp`  | 1080 x 1920 | Home hero below `sm`        | Matching single continuous portrait; trophy lower field with headroom                        |

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

Desktop:

> One continuous near-black violet data room with magenta/pink-violet neon only (no blue half,
> no color split-screen). Perspective grid and one unbroken chart line span the full width.
> Fully visible trophy in the right third with clear margin above the crown. No collage, no seam,
> no flat black left void, no text/logos/UI/people/watermark.

Mobile:

> Portrait companion of the same single continuous magenta data room. Atmosphere fills the upper
> third and left edge. Fully visible trophy with margin above the crown. No collage, seam, flat
> black void, text, logos, UI, people, or watermark.
