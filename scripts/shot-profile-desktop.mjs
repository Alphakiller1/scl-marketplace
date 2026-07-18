import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base =
  "https://scl-marketplace-1z1zp7rdr-alphakiller1s-projects.vercel.app";
const share = "x49CKTSHWH9Y9tPJkFN4L2OUKsYZv9nw";
const outDir = "docs/qa/screenshots";
mkdirSync(outDir, { recursive: true });

function withShare(path) {
  const joiner = path.includes("?") ? "&" : "?";
  return `${base}${path}${joiner}_vercel_share=${share}`;
}

async function inspect(page) {
  return page.evaluate(() => {
    const grids = [...document.querySelectorAll(".grid")];
    const g = grids.find((el) =>
      el.querySelector('[aria-label="Featured proof receipt"]'),
    );
    if (!g) return { err: "no grid" };
    const cs = getComputedStyle(g);
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

    // Stat values that must stay atomic (no mid-% / mid-U wrap)
    const valueSpans = [
      ...document.querySelectorAll(".scl-data.tabular-nums, .scl-data.text-lg"),
    ];
    const wraps = valueSpans
      .map((el) => {
        const text = (el.textContent || "").trim();
        if (!/[%U]$/.test(text) && !/^\+?-?\d/.test(text)) return null;
        const r = el.getBoundingClientRect();
        const lines = Math.round(r.height / 20); // rough
        const cs = getComputedStyle(el);
        return {
          text: text.slice(0, 24),
          h: Math.round(r.height),
          whiteSpace: cs.whiteSpace,
          linesApprox: lines,
        };
      })
      .filter(Boolean)
      .slice(0, 12);

    return {
      cols: cs.gridTemplateColumns,
      trackCount: cs.gridTemplateColumns.split(/\s+/).filter(Boolean).length,
      children,
      wraps,
      vw: window.innerWidth,
    };
  });
}

const browser = await chromium.launch();
const page = await browser.newPage({ colorScheme: "dark" });

for (const width of [1280, 1440, 1536]) {
  await page.setViewportSize({ width, height: 1100 });
  await page.goto(withShare("/cappers/petespicks"), {
    waitUntil: "networkidle",
    timeout: 90_000,
  });
  await page.waitForTimeout(2200);
  const info = await inspect(page);
  console.log(width, JSON.stringify(info, null, 2));
  const proof = page.getByLabel("Featured proof receipt");
  if (await proof.count()) await proof.scrollIntoViewIfNeeded();
  const file =
    width === 1536
      ? `${outDir}/profile-desktop-1536.png`
      : `${outDir}/profile-desktop-${width}.png`;
  await page.screenshot({ path: file });
  console.log("wrote", file);
}

await browser.close();
