# SCL Asset Manifest

Production visual assets live under `public/assets/scl/`. Generated artwork never contains UI
text, metrics, controls, or logos; those remain accessible HTML and code-native components.

Remote sports marks are **self-hosted** (optional) under `public/marks/`, gated by a static
manifest — never hotlinked. Missing marks always render the monogram/lettermark fallback.

| Asset                             | Dimensions | Use                         | Treatment                                        |
| --------------------------------- | ---------: | --------------------------- | ------------------------------------------------ |
| `leaderboard-trophy-desktop.webp` | 1774 x 887 | Home hero at `sm` and above | Right-centered trophy with left copy space       |
| `leaderboard-trophy-mobile.webp`  | 852 x 1846 | Home hero below `sm`        | Trophy in lower field with calm upper copy space |

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
> magenta and electric-blue edge lighting, restrained grid and performance traces, a fully
> visible trophy in the right-center third, and clean negative space for HTML copy. No text,
> numbers, logos, UI, people, sportsbook imagery, or watermark.

Mobile:

> Portrait companion preserving the desktop trophy and lighting, with calm negative space in the
> upper third and the fully visible trophy in the lower-right/center field. No text, numbers,
> logos, UI, people, sportsbook imagery, or watermark.
