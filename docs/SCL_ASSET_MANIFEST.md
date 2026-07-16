# SCL Asset Manifest

Production visual assets live under `public/assets/scl/`. Generated artwork never contains UI
text, metrics, controls, or logos; those remain accessible HTML and code-native components.

Remote sports marks are **self-hosted** (optional) under `public/marks/`, gated by a static
manifest — never hotlinked. Missing marks always render the monogram/lettermark fallback.

| Asset                             |  Dimensions | Use                         | Treatment                                                                 |
| --------------------------------- | ----------: | --------------------------- | ------------------------------------------------------------------------- |
| `leaderboard-trophy-desktop.webp` | 1920 x 1280 | Home hero at `sm` and above | Full-bleed data-space; trophy right; atmosphere/grid/charts to both edges |
| `leaderboard-trophy-mobile.webp`  | 1080 x 1920 | Home hero below `sm`        | Full-bleed portrait; trophy lower field; atmosphere through upper copy    |

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

> Original premium 3D championship trophy in a near-black violet data space, with controlled
> magenta and electric-blue edge lighting. Perspective grid floor and glowing performance chart
> traces MUST extend edge-to-edge across the full width — no flat black dead zone on the left.
> Fully visible trophy in the right third; left two-thirds keep the same room atmosphere (dimmer
> for copy, still textured). No text, numbers, logos, UI, people, sportsbook imagery, or watermark.

Mobile:

> Portrait companion preserving the desktop trophy and lighting. Atmosphere (grid, chart traces,
> volumetric purple/blue light) fills the entire frame including the upper third and left edge —
> never a matte black panel. Fully visible trophy in the lower-right/center field. No text,
> numbers, logos, UI, people, sportsbook imagery, or watermark.
