import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base =
  "https://scl-marketplace-3xi19vml5-alphakiller1s-projects.vercel.app";
const share = "VJbl7V98O3xEWkiOqJpxw54JGYrufkbA";
const profilePath = "/cappers/petespicks";
const outDir = "docs/qa/screenshots";
mkdirSync(outDir, { recursive: true });

function withShare(path) {
  const joiner = path.includes("?") ? "&" : "?";
  return `${base}${path}${joiner}_vercel_share=${share}`;
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
  const title = await page.title();
  console.log(width, "title:", title);
  const proof = page.getByLabel("Featured proof receipt");
  if (await proof.count()) {
    await proof.scrollIntoViewIfNeeded();
  }
  const file = `${outDir}/profile-desktop-${width}.png`;
  await page.screenshot({ path: file });
  console.log("wrote", file);
}

await browser.close();
