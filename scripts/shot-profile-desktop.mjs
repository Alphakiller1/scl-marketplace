import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

/**
 * Profile mock-contract shots and geometry assertions.
 *
 * Prefer the local QA fixture (no database):
 *   ALLOW_QA_SHOTS=1 npm run start
 *   node scripts/shot-profile-desktop.mjs
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
    const tracks = (element) =>
      element
        ? getComputedStyle(element)
            .gridTemplateColumns.split(/\s+/)
            .filter(Boolean)
        : [];
    const rect = (element) => {
      if (!element) return null;
      const value = element.getBoundingClientRect();
      return {
        top: Math.round(value.top),
        bottom: Math.round(value.bottom),
        width: Math.round(value.width),
        height: Math.round(value.height),
      };
    };
    const colorFor = (property) => {
      const probe = document.createElement("span");
      probe.style.backgroundColor = `var(${property})`;
      document.body.append(probe);
      const color = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return color;
    };

    const evidenceGrid = document.querySelector("[data-profile-evidence-grid]");
    const evidenceChildren = evidenceGrid
      ? [...evidenceGrid.children].map(rect)
      : [];
    const metricRow =
      document.querySelector(
        '[role="tabpanel"][data-state="active"] [data-profile-metric-row]',
      ) ??
      [...document.querySelectorAll("[data-profile-metric-row]")].find(
        (element) => getComputedStyle(element).display === "grid",
      );
    const latestProof = document.querySelector(
      '[aria-label="Featured proof receipt"] [data-density="expanded-paper"]',
    );
    const performanceTrend = document.querySelector(
      "[data-profile-performance-trend]",
    );
    const historyLedger = document.querySelector(
      "[data-profile-history-ledger]",
    );
    const profileHistory = document.querySelector("#recent-picks");
    const marketplace = document.querySelector("#storefront");
    const follow = document.querySelector(
      '[data-profile-action-role="relationship"]',
    );
    const ratio =
      evidenceChildren.length >= 2 && evidenceChildren[1]?.width
        ? evidenceChildren[0].width / evidenceChildren[1].width
        : null;

    return {
      viewport: window.innerWidth,
      theme: document.documentElement.classList.contains("dark")
        ? "dark"
        : "light",
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      evidenceTracks: tracks(evidenceGrid).length,
      evidenceRatio: ratio == null ? null : Number(ratio.toFixed(2)),
      metricTracks: tracks(metricRow).length,
      latestProof: rect(latestProof),
      chartInEvidenceTrack:
        evidenceGrid != null &&
        performanceTrend != null &&
        Math.abs(
          evidenceGrid.children[0].getBoundingClientRect().left -
            performanceTrend.getBoundingClientRect().left,
        ) <= 1,
      historyLedger: Boolean(historyLedger?.querySelector("table")),
      defaultHistoryReceipts:
        historyLedger?.querySelectorAll("[data-density]").length ?? null,
      specialtyContext: Boolean(
        document.querySelector("[data-profile-specialties]"),
      ),
      followUsesBlue:
        follow != null &&
        getComputedStyle(follow).backgroundColor === colorFor("--scl-blue"),
      marketplaceAfterHistory:
        profileHistory != null && marketplace != null
          ? marketplace.getBoundingClientRect().top >=
            profileHistory.getBoundingClientRect().bottom
          : null,
    };
  });
}

const browser = await chromium.launch();
let failed = false;

for (const theme of ["dark", "light"]) {
  const page = await browser.newPage({ colorScheme: "dark" });
  for (const width of [375, 1024, 1180, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.goto(withShare(path), {
      waitUntil: "networkidle",
      timeout: 90_000,
    });
    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    );
    if ((theme === "light" && isDark) || (theme === "dark" && !isDark)) {
      await page.getByRole("button", { name: "Toggle Theme" }).click();
      await page.waitForFunction(
        (expected) =>
          document.documentElement.classList.contains("dark") === expected,
        theme === "dark",
      );
    }
    await page.waitForTimeout(500);
    const info = await inspect(page);
    console.log(`${theme} ${width}`, JSON.stringify(info, null, 2));

    const expectedEvidenceTracks = width >= 1024 ? 2 : 1;
    const expectedMetricTracks = width >= 1280 ? 6 : width >= 640 ? 3 : 2;
    const assertions = [
      [info.theme === theme, `expected ${theme} theme, got ${info.theme}`],
      [info.overflow <= 1, `horizontal overflow is ${info.overflow}px`],
      [
        info.evidenceTracks === expectedEvidenceTracks,
        `expected ${expectedEvidenceTracks} Evidence tracks, got ${info.evidenceTracks}`,
      ],
      [
        info.metricTracks === expectedMetricTracks,
        `expected ${expectedMetricTracks} metric tracks, got ${info.metricTracks}`,
      ],
      [Boolean(info.latestProof), "expanded Latest Proof is missing"],
      [
        info.chartInEvidenceTrack,
        "performance chart is not in the Evidence track",
      ],
      [info.historyLedger, "full proof history is not a ledger"],
      [
        info.defaultHistoryReceipts === 0,
        "proof history defaults to expanded receipts",
      ],
      [info.specialtyContext, "specialty context is missing from the header"],
      [info.followUsesBlue, "Follow is not using the blue relationship role"],
      [
        info.marketplaceAfterHistory === true,
        "Marketplace interrupts the evidence-to-history flow",
      ],
    ];

    if (width >= 1280) {
      assertions.push([
        info.evidenceRatio != null &&
          info.evidenceRatio >= 1.75 &&
          info.evidenceRatio <= 2,
        `Evidence | Proof ratio drifted to ${info.evidenceRatio}`,
      ]);
    } else {
      assertions.push([
        info.latestProof != null && info.latestProof.top < 1000,
        `Latest Proof does not enter the first mobile viewport (${info.latestProof?.top})`,
      ]);
    }

    if (theme === "dark" && width === 1440) {
      const scope = page.getByRole("button", { name: "Last 30 Days" });
      await scope.click();
      if ((await scope.getAttribute("aria-pressed")) !== "true") {
        console.error("FAIL dark 1440: performance scope did not change");
        failed = true;
      }
      await page.getByRole("button", { name: "Year to Date" }).click();

      const inspect = page.locator(
        '[data-profile-history-ledger] button[aria-label^="Inspect receipt"]',
      );
      await inspect.nth(0).click();
      await inspect.nth(1).click();
      const expandedReceipts = await page
        .locator('[data-profile-history-ledger] [data-density="feed"]')
        .count();
      if (
        expandedReceipts !== 1 ||
        (await inspect.nth(0).getAttribute("aria-expanded")) !== "false"
      ) {
        console.error(
          "FAIL dark 1440: ledger must keep exactly one receipt expanded",
        );
        failed = true;
      }
      await page
        .locator(
          '[data-profile-history-ledger] button[aria-label^="Close receipt"]',
        )
        .click();
    }

    for (const [pass, message] of assertions) {
      if (!pass) {
        console.error(`FAIL ${theme} ${width}: ${message}`);
        failed = true;
      }
    }

    const file = `${outDir}/profile-contract-${theme}-${width}.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.log("wrote", file);
  }
  await page.close();
}

await browser.close();
if (failed) process.exit(1);
