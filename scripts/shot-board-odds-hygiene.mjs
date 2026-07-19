import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

/**
 * Board odds hygiene shots (dedupe + extreme Review chips).
 *
 *   ALLOW_QA_SHOTS=1 npm run start
 *   node scripts/shot-board-odds-hygiene.mjs
 */
const base = process.env.SHOT_BASE ?? "http://127.0.0.1:3000";
const path = process.env.SHOT_PATH ?? "/qa/board-odds-hygiene";
const outDir = "docs/qa/screenshots";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();

async function shot(theme, sectionId, fileName, interact) {
  const page = await browser.newPage({
    colorScheme: theme,
    viewport: { width: 1280, height: 1100 },
  });
  await page.emulateMedia({ colorScheme: theme });
  await page.goto(`${base}${path}`, {
    waitUntil: "networkidle",
    timeout: 90_000,
  });
  // Prefer class on <html> if the app uses next-themes
  await page.evaluate((t) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.classList.toggle("light", t === "light");
    document.documentElement.style.colorScheme = t;
  }, theme);
  await page.waitForTimeout(800);

  if (interact) await interact(page);

  const section = page.locator(`#${sectionId}`);
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const file = `${outDir}/${fileName}`;
  await section.screenshot({ path: file });
  console.log("wrote", file, theme);

  // Quick assertions for Claude gate
  if (sectionId === "qa-board-dedupe") {
    const counts = await page.evaluate(() => {
      const raw = document.querySelector('[data-qa="raw-board"]')?.children
        .length;
      const deduped = document.querySelector('[data-qa="deduped-board"]')
        ?.children.length;
      return { raw, deduped };
    });
    console.log("dedupe counts", counts);
    if (counts.deduped !== 2 || counts.raw !== 4) {
      throw new Error(
        `Expected raw=4 deduped=2, got raw=${counts.raw} deduped=${counts.deduped}`,
      );
    }
  }

  if (sectionId === "qa-board-extreme") {
    const info = await page.evaluate(() => {
      const chips = [
        ...document.querySelectorAll('[data-qa="extreme-chips"] button'),
      ];
      return chips.map((b) => ({
        text: (b.textContent || "").replace(/\s+/g, " ").trim(),
        disabled: b.disabled,
        pressed: b.getAttribute("aria-pressed"),
      }));
    });
    console.log("extreme chips", info);
    const hasReview = info.some((c) => /Review/i.test(c.text));
    const hasNormal = info.some(
      (c) => /-110/.test(c.text) && !/Review/i.test(c.text),
    );
    if (!hasReview || !hasNormal) {
      throw new Error("Expected Review on extreme chips and unmarked -110");
    }
  }

  await page.close();
}

await shot("dark", "qa-board-dedupe", "board-dedupe-1280.png");
await shot(
  "dark",
  "qa-board-extreme",
  "board-extreme-review-1280.png",
  async (page) => {
    // Select the +940 extreme chip to prove it is selectable
    const first = page.locator('[data-qa="extreme-chips"] button').first();
    await first.click();
    await page.waitForTimeout(300);
    const sel = await page.locator('[data-qa="extreme-selection"]').innerText();
    console.log("selection", sel);
    if (!/Selected \(allowed\)/i.test(sel)) {
      throw new Error(`Extreme chip did not select: ${sel}`);
    }
  },
);
await shot(
  "light",
  "qa-board-extreme",
  "board-extreme-review-1280-light.png",
  async (page) => {
    await page.locator('[data-qa="extreme-chips"] button').first().click();
    await page.waitForTimeout(300);
  },
);

await browser.close();
console.log("board odds hygiene shots OK");
