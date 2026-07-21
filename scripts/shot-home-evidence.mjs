import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const outDir = "docs/qa/screenshots";
mkdirSync(outDir, { recursive: true });

const targets = [
  {
    label: process.env.SHOT_LABEL || "before",
    url:
      process.env.SHOT_URL ||
      "https://scl-marketplace-jw92qa7ta-alphakiller1s-projects.vercel.app/?_vercel_share=BuH7GRkUDZFjg6xNh6A9xsuNfkpLC804",
  },
];

const browser = await chromium.launch();
const page = await browser.newPage({ colorScheme: "dark" });
await page.setViewportSize({ width: 1280, height: 1100 });

for (const t of targets) {
  await page.goto(t.url, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(2500);

  // Hero — first viewport
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({
    path: `${outDir}/home-hero-${t.label}-1280.png`,
  });
  console.log("wrote", `home-hero-${t.label}-1280.png`);

  // Row 1 evidence — scroll to live evidence field
  const field = page.getByLabel("Live evidence field");
  if (await field.count()) {
    await field.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const box = await field.locator(":scope > *").first().boundingBox();
    if (box) {
      await page.screenshot({
        path: `${outDir}/home-evidence-row1-${t.label}-1280.png`,
        clip: {
          x: Math.max(0, box.x - 8),
          y: Math.max(0, box.y - 8),
          width: Math.min(1280, box.width + 16),
          height: box.height + 16,
        },
      });
    } else {
      await page.screenshot({
        path: `${outDir}/home-evidence-row1-${t.label}-1280.png`,
      });
    }
  } else {
    await page.screenshot({
      path: `${outDir}/home-evidence-row1-${t.label}-1280.png`,
    });
  }
  console.log("wrote", `home-evidence-row1-${t.label}-1280.png`);

  const metrics = await page.evaluate(() => {
    const field = document.querySelector('[aria-label="Live evidence field"]');
    const row1 = field?.firstElementChild;
    if (!row1) return null;
    const cs = getComputedStyle(row1);
    // include panes; skip measuring decorative absolute divider via height 0 width
    const panes = [...row1.children]
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          h: Math.round(r.height),
          w: Math.round(r.width),
          ariaHidden: el.getAttribute("aria-hidden"),
          cls: String(el.className).slice(0, 80),
        };
      })
      .filter((p) => p.w > 40);
    return {
      alignItems: cs.alignItems,
      cols: cs.gridTemplateColumns,
      panes,
    };
  });
  console.log("row1 metrics:", JSON.stringify(metrics, null, 2));
}

await browser.close();
