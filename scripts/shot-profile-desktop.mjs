import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base =
  "https://scl-marketplace-git-fix-desktop-p-f470bd-alphakiller1s-projects.vercel.app";
const share = "QtgQNLOpjdObs5nyX2lAuLftAzrK6Sdu";
const outDir = "docs/qa/screenshots";
mkdirSync(outDir, { recursive: true });

function withShare(path) {
  const joiner = path.includes("?") ? "&" : "?";
  return `${base}${path}${joiner}_vercel_share=${share}`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ colorScheme: "dark" });

await page.goto(withShare("/discover"), {
  waitUntil: "networkidle",
  timeout: 90_000,
});
await page.waitForTimeout(2500);

let hrefs = await page.$$eval('a[href*="/cappers/"]', (as) => [
  ...new Set(
    as
      .map((a) => a.getAttribute("href"))
      .filter((h) => h && /^\/cappers\/[^/]+$/.test(h)),
  ),
]);
console.log("discover handles", hrefs.slice(0, 12));

if (!hrefs.length) {
  await page.goto(withShare("/leaderboard"), {
    waitUntil: "networkidle",
    timeout: 90_000,
  });
  await page.waitForTimeout(2500);
  hrefs = await page.$$eval('a[href*="/cappers/"]', (as) => [
    ...new Set(
      as
        .map((a) => a.getAttribute("href"))
        .filter((h) => h && /^\/cappers\/[^/]+$/.test(h)),
    ),
  ]);
  console.log("leaderboard handles", hrefs.slice(0, 12));
}

if (!hrefs.length) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: `${outDir}/profile-no-capper-discover-1280.png`,
  });
  console.error("NO_CAPPER");
  await browser.close();
  process.exit(1);
}

const profilePath = hrefs[0];
for (const width of [1280, 1440]) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(withShare(profilePath), {
    waitUntil: "networkidle",
    timeout: 90_000,
  });
  await page.waitForTimeout(2000);
  const proof = page.getByLabel("Featured proof receipt");
  if (await proof.count()) {
    await proof.scrollIntoViewIfNeeded();
  }
  const file = `${outDir}/profile-desktop-${width}.png`;
  await page.screenshot({ path: file });
  console.log("wrote", file, "for", profilePath);
}

await browser.close();
