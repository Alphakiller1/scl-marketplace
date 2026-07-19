/**
 * WCAG 2.2 AA contrast guards — uses axe-core's color engine so regressions
 * fail `npm test` / CI. Conviction/nav hues are marks/fills only — never
 * small-text fills. Performance/settlement *text* tokens must clear 4.5:1
 * (see design/SCL-DESIGN-SPEC.md "Numeric color system" + "Text-contrast tiers").
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import axe from "axe-core";

/** axe-core commons.color is runtime-complete; typings omit it. */
const colorApi = (
  axe as unknown as {
    commons: {
      color: {
        Color: new (
          r: number,
          g: number,
          b: number,
          a: number,
        ) => { red: number; green: number; blue: number; alpha: number };
        getContrast: (
          bg: { red: number; green: number; blue: number; alpha: number },
          fg: { red: number; green: number; blue: number; alpha: number },
        ) => number;
      };
    };
  }
).commons.color;

const { Color, getContrast } = colorApi;

/** Parse #RRGGBB into an axe Color (opaque). */
function hex(hexColor: string) {
  const h = hexColor.replace("#", "");
  const n = Number.parseInt(h, 16);
  return new Color((n >> 16) & 255, (n >> 8) & 255, n & 255, 1);
}

/** axe getContrast(bg, fg) — AA normal text needs ≥ 4.5. */
function contrast(fg: string, bg: string): number {
  return getContrast(hex(bg), hex(fg));
}

const AA_NORMAL = 4.5;

/** Dark ink / paper tokens (locked in globals.css). */
const DARK = {
  ink: "#07090F",
  ink800: "#121A28",
  ink700: "#1B2536",
  text: "#EDF1F7",
  mutedLabel: "#7E8AA0",
  mutedData: "#AAB6C9",
  pink: "#BA008E",
  blue: "#105FD9",
  pinkInk: "#FFF3FC",
  blueInk: "#F1F9FF",
  win: "#2FBF7B",
  loss: "#E5484D",
  perfMid: "#E6A93C",
  winText: "#2FBF7B",
  lossText: "#FF6B6F",
  perfMidText: "#F0C14D",
  pushText: "#AAB6C9",
  pinkText: "#FF74C8",
} as const;

const LIGHT = {
  paper: "#F3F1EA",
  white: "#FFFFFF",
  surface: "#F5F3ED",
  text: "#161B26",
  mutedLabel: "#6E7686",
  mutedData: "#596273",
  pink: "#A6007F",
  blue: "#044CB6",
  pinkInk: "#FFF3FC",
  blueInk: "#F1F9FF",
  win: "#2FBF7B",
  loss: "#E5484D",
  perfMid: "#B5791E",
  winText: "#0B6B3C",
  lossText: "#B71C1C",
  perfMidText: "#8A5A00",
  pushText: "#596273",
  pinkText: "#A6007F",
} as const;

const HERO = {
  ink: "#07090F",
  text: "#EDF1F7",
  muted: "#C2CCDA",
  blue: "#6EA8FF",
  pinkText: "#FF74C8",
} as const;

function assertAa(fg: string, bg: string, label: string) {
  const ratio = contrast(fg, bg);
  assert.ok(
    ratio >= AA_NORMAL,
    `${label}: ${fg} on ${bg} = ${ratio.toFixed(2)} (need ≥ ${AA_NORMAL})`,
  );
}

describe("a11y contrast — approved text/bg pairs (axe-core)", () => {
  it("dark: text + supporting prose pass AA on ink", () => {
    assertAa(DARK.text, DARK.ink, "dark text/ink");
    assertAa(DARK.mutedData, DARK.ink, "dark muted-data/ink");
  });

  it("light: text + supporting prose (#596273) pass AA on paper", () => {
    assertAa(LIGHT.text, LIGHT.paper, "light text/paper");
    assertAa(LIGHT.mutedData, LIGHT.paper, "light muted-data/paper");
  });

  it("filled CTAs: pink-ink on pink and blue-ink on blue pass AA", () => {
    assertAa(DARK.pinkInk, DARK.pink, "dark pink-ink/pink");
    assertAa(DARK.blueInk, DARK.blue, "dark blue-ink/blue");
    assertAa(LIGHT.pinkInk, LIGHT.pink, "light pink-ink/pink");
    assertAa(LIGHT.blueInk, LIGHT.blue, "light blue-ink/blue");
  });

  it("theme-independent hero copy and interactions clear AA on hero ink", () => {
    assertAa(HERO.text, HERO.ink, "hero text/ink");
    assertAa(HERO.muted, HERO.ink, "hero supporting/ink");
    assertAa(HERO.blue, HERO.ink, "hero focus and active marks/ink");
    assertAa(HERO.pinkText, HERO.ink, "hero title hover/ink");
  });
});

describe("a11y contrast — performance/settlement text tokens ≥ 4.5:1", () => {
  it("dark: win/loss/mid/push text clear AA on ink, ink-800, ink-700", () => {
    for (const bg of [DARK.ink, DARK.ink800, DARK.ink700] as const) {
      assertAa(DARK.winText, bg, `dark win-text`);
      assertAa(DARK.lossText, bg, `dark loss-text`);
      assertAa(DARK.perfMidText, bg, `dark perf-mid-text`);
      assertAa(DARK.pushText, bg, `dark push-text`);
      assertAa(DARK.pinkText, bg, `dark pink-text`); // hero title hover
    }
  });

  it("light: win/loss/mid/push text clear AA on paper, white, #F5F3ED", () => {
    for (const bg of [LIGHT.paper, LIGHT.white, LIGHT.surface] as const) {
      assertAa(LIGHT.winText, bg, `light win-text`);
      assertAa(LIGHT.lossText, bg, `light loss-text`);
      assertAa(LIGHT.perfMidText, bg, `light perf-mid-text`);
      assertAa(LIGHT.pushText, bg, `light push-text`);
      assertAa(LIGHT.pinkText, bg, `light pink-text`); // hero title hover
    }
  });

  it("supporting muted-data (eyebrow tier) clears AA in both themes", () => {
    assertAa(DARK.mutedData, DARK.ink, "dark eyebrow/supporting");
    assertAa(DARK.mutedData, DARK.ink800, "dark eyebrow on card");
    assertAa(LIGHT.mutedData, LIGHT.paper, "light eyebrow/supporting");
    assertAa(LIGHT.mutedData, LIGHT.white, "light eyebrow on white card");
  });
});

describe("a11y contrast — conviction/nav hues must NOT be small-text fills", () => {
  it("documents the verified dark failures (pink/blue on ink < 4.5)", () => {
    const pinkRatio = contrast(DARK.pink, DARK.ink);
    const blueRatio = contrast(DARK.blue, DARK.ink);
    assert.ok(pinkRatio < AA_NORMAL, `expected pink fail, got ${pinkRatio}`);
    assert.ok(blueRatio < AA_NORMAL, `expected blue fail, got ${blueRatio}`);
    // Guard the measured failures stay in the known band (≈3.30 / ≈3.47).
    assert.ok(pinkRatio > 3 && pinkRatio < 4);
    assert.ok(blueRatio > 3 && blueRatio < 4);
  });

  it("documents bright mark hues fail as light-theme small text", () => {
    assert.ok(contrast(LIGHT.win, LIGHT.paper) < AA_NORMAL);
    assert.ok(contrast(LIGHT.loss, LIGHT.paper) < AA_NORMAL);
    assert.ok(contrast(LIGHT.perfMid, LIGHT.paper) < AA_NORMAL);
  });

  it("documents light muted-label (#6E7686) fails AA as normal prose on paper", () => {
    const ratio = contrast(LIGHT.mutedLabel, LIGHT.paper);
    assert.ok(
      ratio < AA_NORMAL,
      `expected light muted-label fail as prose, got ${ratio}`,
    );
  });

  it("dark muted-label is for labels only — supporting prose uses muted-data", () => {
    assert.ok(
      contrast(DARK.mutedData, DARK.ink) > contrast(DARK.mutedLabel, DARK.ink),
    );
  });
});

describe("a11y contrast — ban blue/pink/live as text fills in source", () => {
  /**
   * Regression guard for the storefront Responsible-gaming `text-live` slip:
   * conviction/nav hues are marks/icons only. Links use `.scl-link`; labels and
   * values use AA text tokens (`text-foreground`, `--scl-*-text`, etc.).
   */
  it("flags text-live / text-brand / raw blue|pink on text hosts", () => {
    const root = join(process.cwd(), "src");
    const files: string[] = [];

    function walk(dir: string) {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) walk(p);
        else if (/\.(tsx|ts)$/.test(name) && !name.includes(".test.")) {
          files.push(p);
        }
      }
    }
    walk(root);

    const textHost =
      /<(?:Link|a|p|label|h[1-6]|button)\b[^>]*\b(?:text-live|text-brand|text-\[color:var\(--scl-(?:blue|pink)\)\])\b/;
    const bareTextLive =
      /\b(?:className|class)=\{?["'`][^"'`]*\btext-live\b[^"'`]*["'`]/;
    const bareTextBrand =
      /\b(?:className|class)=\{?["'`][^"'`]*\btext-brand\b(?!-foreground)[^"'`]*["'`]/;
    const offenses: string[] = [];

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const rel = file.slice(process.cwd().length + 1).replace(/\\/g, "/");
      if (textHost.test(src)) {
        offenses.push(`${rel}: text host uses live/brand/raw blue|pink fill`);
      }
      // Remaining text-live / text-brand are text fills — icons use raw --scl-blue|pink.
      if (bareTextLive.test(src)) {
        offenses.push(
          `${rel}: text-live used (prefer .scl-link or AA text token)`,
        );
      }
      if (bareTextBrand.test(src)) {
        offenses.push(
          `${rel}: text-brand used as text fill (prefer .scl-link or AA text token)`,
        );
      }
    }

    assert.deepEqual(
      offenses,
      [],
      `Blue/pink/live text fills:\n${offenses.join("\n")}`,
    );
  });
});
