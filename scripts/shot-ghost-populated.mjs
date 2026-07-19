import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.env.SHOT_BASE ?? "http://127.0.0.1:3000";
const outDir = "docs/qa/screenshots";
mkdirSync(outDir, { recursive: true });

const shots = [
  { path: "/leaderboard", file: "ghost-leaderboard-1280.png" },
  { path: "/discover", file: "ghost-discover-1280.png" },
  { path: "/cappers/linehawk", file: "ghost-profile-linehawk-1280.png" },
  { path: "/packages", file: "ghost-packages-1280.png" },
  { path: "/", file: "ghost-home-1280.png" },
];

const browser = await chromium.launch();
const page = await browser.newPage({
  colorScheme: "dark",
  viewport: { width: 1280, height: 1400 },
});

for (const s of shots) {
  await page.goto(`${base}${s.path}`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await page.waitForTimeout(2000);
  // Prefer dark class if next-themes present
  await page.evaluate(() => {
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
  });
  await page.waitForTimeout(500);
  const file = `${outDir}/${s.file}`;
  const fullPage = s.path === "/discover" || s.path === "/packages";
  await page.screenshot({ path: file, fullPage });
  console.log("wrote", file, "→", await page.title());
}

await browser.close();
console.log("ghost populated-state shots OK");
