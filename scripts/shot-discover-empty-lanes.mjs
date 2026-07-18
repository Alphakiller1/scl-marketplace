import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base =
  "https://scl-marketplace-je48caq38-alphakiller1s-projects.vercel.app";
const share = "SV0GgrLG42uFdE24hox8o8tlQcTW89BU";
const outDir = "docs/qa/screenshots";
mkdirSync(outDir, { recursive: true });

function withShare(path) {
  const joiner = path.includes("?") ? "&" : "?";
  return `${base}${path}${joiner}_vercel_share=${share}`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ colorScheme: "dark" });
await page.setViewportSize({ width: 1280, height: 1100 });
await page.goto(withShare("/discover"), {
  waitUntil: "networkidle",
  timeout: 90_000,
});
await page.waitForTimeout(2000);

const live = await page.evaluate(() => {
  const blocks = [...document.querySelectorAll(".mt-8.space-y-10")];
  const desktop = blocks.find((el) => getComputedStyle(el).display !== "none");
  const index = desktop?.querySelector(
    '[aria-labelledby="discover-empty-lanes"]',
  );
  return {
    desktopHeight: desktop
      ? Math.round(desktop.getBoundingClientRect().height)
      : null,
    indexRows: index?.querySelectorAll("li").length ?? 0,
    filledLaneHeads: desktop
      ? [...desktop.querySelectorAll("h2[id^='discover-lane-']")].length
      : 0,
  };
});
console.log("live:", live);

// (a) all lanes empty — compact index only (live preview state)
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
await page.screenshot({
  path: `${outDir}/discover-desktop-all-empty-1280.png`,
});
console.log("wrote discover-desktop-all-empty-1280.png", {
  desktopHeight: live.desktopHeight,
});

// (b) mixed — live has 0 filled lanes; prepend one filled strip using a real
// public handle from Browse (compositional QA crop, not product fabrication).
await page.evaluate(() => {
  const blocks = [...document.querySelectorAll(".mt-8.space-y-10")];
  const desktop = blocks.find((el) => getComputedStyle(el).display !== "none");
  if (!desktop) return;

  const browse = document.querySelector("[aria-labelledby='discover-browse']");
  const firstCard = browse?.querySelector(".grid > .group\\/card, .grid > *");
  const handle =
    firstCard?.textContent?.match(/@([a-z0-9_]+)/i)?.[1] ?? "petespicks";
  const href = `/cappers/${handle}`;

  const filled = document.createElement("section");
  filled.className = "space-y-3";
  filled.setAttribute("data-visual-mode", "rank");
  filled.setAttribute("aria-labelledby", "discover-lane-proven");
  filled.innerHTML = `
    <div class="min-w-0 border-t border-[color:var(--scl-line)] pt-3">
      <div class="flex items-start gap-2">
        <div class="min-w-0">
          <h2 id="discover-lane-proven" class="scl-display text-base font-bold tracking-[0.04em] sm:text-lg">Proven over time</h2>
          <p class="text-muted-foreground mt-1 text-sm leading-relaxed">Cappers with long-window records and enough graded picks for stronger context.</p>
        </div>
      </div>
    </div>
    <ul class="divide-border border-border divide-y border-y">
      <li>
        <a href="${href}" class="hover:bg-surface-2/60 flex flex-col gap-2.5 py-3 sm:flex-row sm:items-center sm:gap-4">
          <div class="flex min-w-0 flex-1 items-center gap-3">
            <div class="bg-surface-2 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">${handle.slice(0, 1).toUpperCase()}</div>
            <div class="min-w-0">
              <div class="scl-display text-sm font-bold tracking-[0.02em]">@${handle}</div>
              <div class="text-muted-foreground mt-0.5 text-xs">Public record · lane primary metric</div>
            </div>
          </div>
          <div class="flex shrink-0 items-end gap-4 sm:flex-col sm:items-end">
            <div class="text-right">
              <div class="scl-data text-foreground text-base font-semibold tabular-nums">—</div>
              <div class="scl-eyebrow text-muted-foreground">Long-term ROI</div>
            </div>
          </div>
        </a>
      </li>
    </ul>
  `;
  desktop.insertBefore(filled, desktop.firstElementChild);
});

await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(400);
const mixedMeta = await page.evaluate(() => {
  const blocks = [...document.querySelectorAll(".mt-8.space-y-10")];
  const desktop = blocks.find((el) => getComputedStyle(el).display !== "none");
  const index = desktop?.querySelector(
    '[aria-labelledby="discover-empty-lanes"]',
  );
  return {
    desktopHeight: desktop
      ? Math.round(desktop.getBoundingClientRect().height)
      : null,
    sections: desktop?.querySelectorAll(":scope > section").length ?? 0,
    indexRows: index?.querySelectorAll("li").length ?? 0,
  };
});
await page.screenshot({
  path: `${outDir}/discover-desktop-mixed-1280.png`,
});
console.log("wrote discover-desktop-mixed-1280.png", mixedMeta);

await browser.close();
