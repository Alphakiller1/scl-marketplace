import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

/**
 * Desktop profile composition shots (2-col peers + full-width Marketplace band).
 *
 * Prefer local QA fixture (no DB):
 *   ALLOW_QA_SHOTS=1 npm run start
 *   node scripts/shot-profile-desktop.mjs
 *
 * Or set SHOT_BASE to a preview URL that includes this branch.
 */
const base = process.env.SHOT_BASE ?? "http://127.0.0.1:3000";
const path = process.env.SHOT_PATH ?? "/qa/desktop-profile-composition";
const share = process.env.SHOT_SHARE ?? "";
const outDir = "docs/qa/screenshots";
mkdirSync(outDir, { recursive: true });

function withShare(targetPath) {
  if (!share) return `${base}${targetPath}`;
  const joiner = targetPath.includes("?") ? "&" : "?";
  return `${base}${targetPath}${joiner}_vercel_share=${share}`;
}

async function inspect(page) {
  return page.evaluate(() => {
    const grids = [...document.querySelectorAll(".grid")];
    const g = grids.find((el) =>
      el.querySelector('[aria-label="Featured proof receipt"]'),
    );
    if (!g) return { err: "no grid" };
    const cs = getComputedStyle(g);
    const tracks = cs.gridTemplateColumns.split(/\s+/).filter(Boolean);
    const children = [...g.children].map((c, i) => {
      const r = c.getBoundingClientRect();
      return {
        i,
        tag: c.tagName,
        top: Math.round(r.top),
        left: Math.round(r.left),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    });

    const valueSpans = [
      ...document.querySelectorAll(".scl-data.tabular-nums, .scl-data.text-lg"),
    ];
    const wraps = valueSpans
      .map((el) => {
        const text = (el.textContent || "").trim();
        if (!/[%U]$/.test(text) && !/^\+?-?\d/.test(text)) return null;
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          text: text.slice(0, 24),
          h: Math.round(r.height),
          whiteSpace: style.whiteSpace,
          collidingSibling: (() => {
            const next = el.nextElementSibling;
            if (!next) return false;
            const nr = next.getBoundingClientRect();
            return Math.abs(nr.left - r.right) < 2 && nr.top < r.bottom;
          })(),
        };
      })
      .filter(Boolean)
      .slice(0, 12);

    const aside = g.querySelector("aside");
    const asideRect = aside?.getBoundingClientRect();
    const firstRect = g.children[0]?.getBoundingClientRect();

    return {
      cols: cs.gridTemplateColumns,
      trackCount: tracks.length,
      marketplaceIsBand:
        aside && firstRect
          ? Math.round(asideRect.top) >= Math.round(firstRect.bottom) - 2
          : null,
      children,
      wraps,
      vw: window.innerWidth,
    };
  });
}

const browser = await chromium.launch();
const page = await browser.newPage({ colorScheme: "dark" });

let failed = false;
for (const width of [1280, 1440, 1536]) {
  await page.setViewportSize({ width, height: 1100 });
  await page.goto(withShare(path), {
    waitUntil: "networkidle",
    timeout: 90_000,
  });
  await page.waitForTimeout(1500);
  const info = await inspect(page);
  console.log(width, JSON.stringify(info, null, 2));

  if (info.err) {
    console.error(`FAIL ${width}: ${info.err}`);
    failed = true;
  } else if (info.trackCount !== 2) {
    console.error(
      `FAIL ${width}: expected 2 grid tracks, got ${info.trackCount}`,
    );
    failed = true;
  } else if (info.marketplaceIsBand === false) {
    console.error(`FAIL ${width}: Marketplace is not a full-width band`);
    failed = true;
  }

  const proof = page.getByLabel("Featured proof receipt");
  if (await proof.count()) await proof.scrollIntoViewIfNeeded();
  const file = `${outDir}/profile-desktop-${width}.png`;
  await page.screenshot({ path: file });
  console.log("wrote", file);
}

await browser.close();
if (failed) process.exit(1);
