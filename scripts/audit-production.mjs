import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

const BASE_URL = "https://sportscappersleaderboard.com";
const SCREENSHOTS_DIR = "/opt/cursor/artifacts/screenshots";

// Ensure screenshots directory exists
mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const ROUTES = [
  { path: "/", name: "home" },
  { path: "/leaderboard", name: "leaderboard" },
  { path: "/discover", name: "discover" },
  { path: "/picks", name: "picks" },
  { path: "/packages", name: "packages" },
  { path: "/cappers", name: "cappers" },
  { path: "/verification", name: "verification" },
  { path: "/support", name: "support" },
  { path: "/terms", name: "terms" },
  { path: "/privacy", name: "privacy" },
  { path: "/disclaimer", name: "disclaimer" },
  { path: "/responsible-gaming", name: "responsible-gaming" },
  { path: "/refund-policy", name: "refund-policy" },
  { path: "/robots.txt", name: "robots-txt" },
  { path: "/sitemap.xml", name: "sitemap-xml" },
  { path: "/api/health", name: "api-health" },
  {
    path: "/qa/board-odds-hygiene",
    name: "qa-board-odds-hygiene",
    shouldBe404: true,
  },
  {
    path: "/qa/desktop-profile-composition",
    name: "qa-desktop-profile-composition",
    shouldBe404: true,
  },
];

const VIEWPORTS = [
  { width: 375, height: 667, name: "mobile" },
  { width: 768, height: 1024, name: "tablet" },
  { width: 1440, height: 900, name: "desktop" },
  { width: 1536, height: 864, name: "desktop-xl" },
];

const findings = {
  routes: [],
  designViolations: [],
  layoutIssues: [],
  consoleErrors: [],
  networkErrors: [],
};

async function auditRoute(browser, route, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    userAgent: "Mozilla/5.0 (compatible; ProductionAudit/1.0)",
  });

  const page = await context.newPage();
  const url = `${BASE_URL}${route.path}`;

  const consoleMessages = [];
  const networkErrors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
      });
    }
  });

  page.on("response", (response) => {
    if (response.status() >= 400) {
      networkErrors.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
      });
    }
  });

  try {
    const response = await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    const status = response.status();
    const title = await page.title();

    // Check if route should be 404
    if (route.shouldBe404 && status !== 404) {
      findings.routes.push({
        route: route.path,
        issue: `Expected 404 but got ${status}`,
        viewport: viewport.name,
      });
    } else if (!route.shouldBe404 && status !== 200) {
      findings.routes.push({
        route: route.path,
        issue: `Expected 200 but got ${status}`,
        viewport: viewport.name,
      });
    }

    // Take screenshot for non-404 pages
    if (status === 200 || !route.shouldBe404) {
      const screenshotPath = `${SCREENSHOTS_DIR}/${route.name}-${viewport.name}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // Check for horizontal overflow
      const hasHorizontalScroll = await page.evaluate(() => {
        return (
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth
        );
      });

      if (hasHorizontalScroll) {
        findings.layoutIssues.push({
          route: route.path,
          viewport: viewport.name,
          issue: "Horizontal overflow detected",
        });
      }

      // Design law checks (only on desktop viewport)
      if (viewport.name === "desktop") {
        const designChecks = await page.evaluate(() => {
          const results = {
            goldElements: [],
            handleText: [],
            dollarSigns: [],
          };

          // Check for gold color (various shades)
          const allElements = document.querySelectorAll("*");
          allElements.forEach((el) => {
            const style = window.getComputedStyle(el);
            const color = style.color;
            const bgColor = style.backgroundColor;

            // Check for gold-ish colors (hsl around 45-60 degrees, high saturation)
            if (
              color.includes("rgb(255, 215") ||
              color.includes("rgb(255, 223") ||
              color.includes("gold") ||
              bgColor.includes("rgb(255, 215") ||
              bgColor.includes("rgb(255, 223") ||
              bgColor.includes("gold")
            ) {
              results.goldElements.push(
                el.tagName + (el.className ? "." + el.className : ""),
              );
            }
          });

          // Check for "handle" word
          const bodyText = document.body.innerText;
          if (bodyText.toLowerCase().includes("handle")) {
            const matches = bodyText.match(/\bhandle\b/gi);
            if (matches) {
              results.handleText = matches.map((m) => m);
            }
          }

          // Check for dollar signs in content
          if (bodyText.includes("$")) {
            const lines = bodyText
              .split("\n")
              .filter((line) => line.includes("$"));
            results.dollarSigns = lines.slice(0, 5); // First 5 instances
          }

          return results;
        });

        if (designChecks.goldElements.length > 0) {
          findings.designViolations.push({
            route: route.path,
            violation: "Gold color detected",
            elements: designChecks.goldElements,
          });
        }

        if (designChecks.handleText.length > 0) {
          findings.designViolations.push({
            route: route.path,
            violation: 'Word "handle" detected',
            instances: designChecks.handleText.length,
          });
        }

        if (designChecks.dollarSigns.length > 0) {
          findings.designViolations.push({
            route: route.path,
            violation: "Dollar signs detected (should use units)",
            examples: designChecks.dollarSigns,
          });
        }
      }

      return {
        status,
        title,
        screenshot: screenshotPath,
        consoleMessages,
        networkErrors,
      };
    }

    return {
      status,
      title: route.shouldBe404 ? "Expected 404" : title,
      consoleMessages,
      networkErrors,
    };
  } catch (error) {
    return {
      error: error.message,
      consoleMessages,
      networkErrors,
    };
  } finally {
    await context.close();
  }
}

async function main() {
  console.log("🚀 Starting production audit...\n");

  const browser = await chromium.launch({
    executablePath: "/usr/local/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const allResults = [];

  for (const route of ROUTES) {
    console.log(`\n📋 Auditing: ${route.path}`);

    for (const viewport of VIEWPORTS) {
      console.log(`  ${viewport.name} (${viewport.width}x${viewport.height})`);
      const result = await auditRoute(browser, route, viewport);

      allResults.push({
        route: route.path,
        viewport: viewport.name,
        ...result,
      });

      if (result.consoleMessages && result.consoleMessages.length > 0) {
        findings.consoleErrors.push({
          route: route.path,
          viewport: viewport.name,
          messages: result.consoleMessages,
        });
      }

      if (result.networkErrors && result.networkErrors.length > 0) {
        findings.networkErrors.push({
          route: route.path,
          viewport: viewport.name,
          errors: result.networkErrors,
        });
      }
    }
  }

  await browser.close();

  // Save detailed results
  const reportPath = "/workspace/audit-report.json";
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        baseUrl: BASE_URL,
        results: allResults,
        findings,
      },
      null,
      2,
    ),
  );

  console.log("\n\n✅ Audit complete!");
  console.log(`📄 Report saved to: ${reportPath}`);
  console.log(`📸 Screenshots saved to: ${SCREENSHOTS_DIR}`);

  // Print summary
  console.log("\n\n📊 SUMMARY:");
  console.log(`Total routes tested: ${ROUTES.length}`);
  console.log(`Total viewports tested: ${VIEWPORTS.length}`);
  console.log(`Design violations: ${findings.designViolations.length}`);
  console.log(`Layout issues: ${findings.layoutIssues.length}`);
  console.log(`Console errors: ${findings.consoleErrors.length}`);
  console.log(`Network errors: ${findings.networkErrors.length}`);

  if (findings.designViolations.length > 0) {
    console.log("\n⚠️  DESIGN VIOLATIONS:");
    findings.designViolations.forEach((v) => {
      console.log(`  ${v.route}: ${v.violation}`);
    });
  }

  if (findings.layoutIssues.length > 0) {
    console.log("\n⚠️  LAYOUT ISSUES:");
    findings.layoutIssues.forEach((i) => {
      console.log(`  ${i.route} (${i.viewport}): ${i.issue}`);
    });
  }
}

main().catch(console.error);
