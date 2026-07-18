/**
 * WCAG 2.2 AA contrast guards — uses axe-core's color engine so regressions
 * fail `npm test` / CI. Conviction/nav hues are marks/fills only — never
 * small-text fills (see design/SCL-DESIGN-SPEC.md "Text-contrast tiers").
 */

import assert from "node:assert/strict";
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
  text: "#EDF1F7",
  mutedLabel: "#7E8AA0",
  mutedData: "#AAB6C9",
  pink: "#BA008E",
  blue: "#105FD9",
  pinkInk: "#FFF3FC",
  blueInk: "#F1F9FF",
} as const;

const LIGHT = {
  paper: "#F3F1EA",
  text: "#161B26",
  mutedLabel: "#6E7686",
  mutedData: "#596273",
  pink: "#A6007F",
  blue: "#044CB6",
  pinkInk: "#FFF3FC",
  blueInk: "#F1F9FF",
} as const;

describe("a11y contrast — approved text/bg pairs (axe-core)", () => {
  it("dark: text + supporting prose pass AA on ink", () => {
    assert.ok(contrast(DARK.text, DARK.ink) >= AA_NORMAL);
    assert.ok(contrast(DARK.mutedData, DARK.ink) >= AA_NORMAL);
  });

  it("light: text + supporting prose (#596273) pass AA on paper", () => {
    assert.ok(contrast(LIGHT.text, LIGHT.paper) >= AA_NORMAL);
    assert.ok(
      contrast(LIGHT.mutedData, LIGHT.paper) >= AA_NORMAL,
      `light muted-data on paper = ${contrast(LIGHT.mutedData, LIGHT.paper).toFixed(2)}`,
    );
  });

  it("filled CTAs: pink-ink on pink and blue-ink on blue pass AA", () => {
    assert.ok(contrast(DARK.pinkInk, DARK.pink) >= AA_NORMAL);
    assert.ok(contrast(DARK.blueInk, DARK.blue) >= AA_NORMAL);
    assert.ok(contrast(LIGHT.pinkInk, LIGHT.pink) >= AA_NORMAL);
    assert.ok(contrast(LIGHT.blueInk, LIGHT.blue) >= AA_NORMAL);
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

  it("documents light muted-label (#6E7686) fails AA as normal prose on paper", () => {
    const ratio = contrast(LIGHT.mutedLabel, LIGHT.paper);
    assert.ok(
      ratio < AA_NORMAL,
      `expected light muted-label fail as prose, got ${ratio}`,
    );
  });

  it("dark muted-label is for labels only — supporting prose uses muted-data", () => {
    // Label may sit near the AA edge; prose must use muted-data (tested above).
    assert.ok(
      contrast(DARK.mutedData, DARK.ink) > contrast(DARK.mutedLabel, DARK.ink),
    );
  });
});
