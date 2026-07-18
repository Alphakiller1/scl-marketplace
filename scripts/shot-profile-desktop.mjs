import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base =
  "https://scl-marketplace-9tst4jz6k-alphakiller1s-projects.vercel.app";
const share = "LmnXaiGIYOi360BHjOw1jKPASKUqq9qM";
const profilePath = "/cappers/petespicks";
const outDir = "docs/qa/screenshots";
mkdirSync(outDir, { recursive: true });

function withShare(path) {
  const joiner = path.includes("?") ? "&" : "?";
  return `${base}${path}${joiner}_vercel_share=${share}`;
}

async function inspect(page, width) {
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
    return {
      cols: cs.gridTemplateColumns,
      trackCount: cs.gridTemplateColumns.split(" ").filter(Boolean).length,
      children,
      vw: window.innerWidth,
    };
  });
}

const browser = await chromium.launch();
const page = await browser.newPage({ colorScheme: "dark" });

for (const width of [1280, 1440]) {
  await page.setViewportSize({ width, height: 1100 });
  await page.goto(withShare(profilePath), {
    waitUntil: "networkidle",
    timeout: 90_000,
  });
  await page.waitForTimeout(2500);
  const info = await inspect(page, width);
  console.log(width, JSON.stringify(info, null, 2));
  const proof = page.getByLabel("Featured proof receipt");
  if (await proof.count()) {
    await proof.scrollIntoViewIfNeeded();
  }
  const file = `${outDir}/profile-desktop-${width}.png`;
  await page.screenshot({ path: file });
  console.log("wrote", file);
}

await browser.close();
