/**
 * Neon trophy backdrop for the share graphics.
 *
 * Drawn as stacked strokes rather than a blur filter: satori renders SVG
 * geometry, not CSS/SVG filters, so the glow is four passes of the same paths
 * — wide and faint, mid, bright core, then a white hairline. Pink only; the
 * design spec keeps blue for navigation, so the owner's neon composition
 * arrives in the conviction hue.
 *
 * Every element here is literal. satori resolves function components in HTML
 * but NOT inside an `<svg>`: a nested component there renders nothing at all,
 * silently. `.map` over elements is fine.
 */

const CUP = "M60 22 H140 V72 C140 102 122 124 100 124 C78 124 60 102 60 72 Z";
const HANDLE_LEFT = "M60 34 C26 34 22 74 54 90";
const HANDLE_RIGHT = "M140 34 C174 34 178 74 146 90";
const STEM = "M92 124 V152 M108 124 V152 M82 152 H118";
const BASE = "M58 158 H142 L152 182 H48 Z";
const PLINTH = "M44 190 H156";
const CROWN =
  "M70 22 L62 -2 L84 10 L100 -12 L116 10 L138 -2 L130 22 Z M70 30 H130";

const PATHS = [CROWN, CUP, HANDLE_LEFT, HANDLE_RIGHT, STEM, BASE, PLINTH];

export function NeonTrophy({
  width,
  height,
  color,
  core,
}: {
  width: number;
  height: number;
  color: string;
  core: string;
}) {
  return (
    <svg viewBox="-6 -20 212 222" width={width} height={height} fill="none">
      <g
        stroke={color}
        strokeWidth={16}
        strokeOpacity={0.07}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g
        stroke={color}
        strokeWidth={7}
        strokeOpacity={0.16}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g
        stroke={color}
        strokeWidth={2.5}
        strokeOpacity={0.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g
        stroke={core}
        strokeWidth={0.9}
        strokeOpacity={0.22}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
