/**
 * Code-native neon stage for SCL Honors share graphics.
 *
 * Satori does not render SVG/CSS blur filters reliably, so the light is built
 * from stacked translucent geometry. It stays crisp at every export size and
 * never bakes award text or player data into a raster asset.
 */

const CUP = "M60 22 H140 V72 C140 102 122 124 100 124 C78 124 60 102 60 72 Z";
const HANDLE_LEFT = "M60 34 C26 34 22 74 54 90";
const HANDLE_RIGHT = "M140 34 C174 34 178 74 146 90";
const STEM = "M92 124 V152 M108 124 V152 M82 152 H118";
const BASE = "M58 158 H142 L152 182 H48 Z";
const PLINTH = "M44 190 H156";
const CROWN =
  "M70 22 L62 -2 L84 10 L100 -12 L116 10 L138 -2 L130 22 Z M70 30 H130";

function strokeStack({
  paths,
  color,
  core,
}: {
  paths: readonly string[];
  color: string;
  core: string;
}) {
  const passes = [
    { width: 20, opacity: 0.07, tone: color },
    { width: 10, opacity: 0.12, tone: color },
    { width: 5, opacity: 0.28, tone: color },
    { width: 2.4, opacity: 0.8, tone: color },
    { width: 0.85, opacity: 0.92, tone: core },
  ];
  return passes.map((pass) => (
    <g
      key={`${pass.tone}-${pass.width}`}
      stroke={pass.tone}
      strokeWidth={pass.width}
      strokeOpacity={pass.opacity}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </g>
  ));
}

/** Blue-left, purple-center, pink-right trophy from the SCL brand spectrum. */
export function NeonTrophy({
  width,
  height,
  blue,
  purple,
  pink,
  core,
}: {
  width: number;
  height: number;
  blue: string;
  purple: string;
  pink: string;
  core: string;
}) {
  return (
    <svg viewBox="-6 -20 212 222" width={width} height={height} fill="none">
      {strokeStack({ paths: [HANDLE_LEFT], color: blue, core })}
      {strokeStack({
        paths: [CROWN, CUP, STEM, BASE, PLINTH],
        color: purple,
        core,
      })}
      {strokeStack({ paths: [HANDLE_RIGHT], color: pink, core })}
    </svg>
  );
}

/** Atmospheric brand light and a reflective award-stage floor. */
export function HonorNeonStage() {
  return (
    <svg
      width="1080"
      height="1350"
      viewBox="0 0 1080 1350"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="blue-haze">
          <stop offset="0" stopColor="#1688FF" stopOpacity="0.28" />
          <stop offset="1" stopColor="#1688FF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="pink-haze">
          <stop offset="0" stopColor="#E500C8" stopOpacity="0.3" />
          <stop offset="1" stopColor="#E500C8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="purple-haze">
          <stop offset="0" stopColor="#7629FF" stopOpacity="0.3" />
          <stop offset="1" stopColor="#7629FF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="floor-line" x1="100" y1="0" x2="980" y2="0">
          <stop stopColor="#1688FF" stopOpacity="0" />
          <stop offset="0.18" stopColor="#1688FF" stopOpacity="0.85" />
          <stop offset="0.5" stopColor="#7B2BFF" stopOpacity="0.72" />
          <stop offset="0.82" stopColor="#E500C8" stopOpacity="0.85" />
          <stop offset="1" stopColor="#E500C8" stopOpacity="0" />
        </linearGradient>
      </defs>

      <ellipse cx="206" cy="555" rx="360" ry="430" fill="url(#blue-haze)" />
      <ellipse cx="874" cy="555" rx="360" ry="430" fill="url(#pink-haze)" />
      <ellipse cx="540" cy="680" rx="430" ry="490" fill="url(#purple-haze)" />

      <path
        d="M-30 710 C140 625 212 805 370 725 C510 653 592 745 735 695 C882 644 972 738 1120 662"
        stroke="#167FFF"
        strokeOpacity="0.055"
        strokeWidth="72"
      />
      <path
        d="M-20 808 C123 730 245 868 390 790 C548 705 652 853 795 768 C920 695 1001 762 1100 718"
        stroke="#D900C2"
        strokeOpacity="0.05"
        strokeWidth="88"
      />
      <path
        d="M38 648 C205 575 295 694 430 622 C559 553 674 662 810 605 C917 560 1004 603 1090 554"
        stroke="#7A2BFF"
        strokeOpacity="0.06"
        strokeWidth="38"
      />

      <path d="M160 1204 H920" stroke="url(#floor-line)" strokeWidth="4" />
      <path
        d="M220 1215 H860 L915 1250 H165 Z"
        stroke="url(#floor-line)"
        strokeWidth="3"
        fill="#10182A"
        fillOpacity="0.78"
      />
      <path
        d="M270 1230 H810 L845 1262 H235 Z"
        stroke="#7B2BFF"
        strokeOpacity="0.48"
        strokeWidth="2"
      />
      <path d="M110 1277 H970" stroke="url(#floor-line)" strokeWidth="2" />
    </svg>
  );
}
