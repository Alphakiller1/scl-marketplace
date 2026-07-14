/**
 * Route conformance visual QA ΓÇö SCL-DESIGN-SPEC application surfaces.
 * Run: npx tsx scripts/route-conformance-qa.ts
 * Expects a local server at BASE_URL (default http://127.0.0.1:3000).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const OUT = join(process.cwd(), "tmp", "route-qa");

const ROUTES = [
  { id: "home", path: "/" },
  { id: "leaderboard", path: "/leaderboard" },
  { id: "picks", path: "/picks" },
  { id: "pick-new", path: "/dashboard/picks/new" },
  { id: "pick-parlay", path: "/dashboard/picks/new/parlay" },
] as const;

const VIEWPORTS = [
  { id: "375", width: 375, height: 812 },
  { id: "1280", width: 1280, height: 800 },
] as const;

const THEMES = ["dark", "light"] as const;

type Finding = {
  route: string;
  viewport: string;
  theme: string;
  check: string;
  status: "PASS" | "FAIL" | "WARN" | "SKIP";
  detail: string;
};

async function setTheme(page: Page, theme: "dark" | "light") {
  await page.emulateMedia({ colorScheme: theme });
  await page.evaluate((t: "dark" | "light") => {
    const root = document.documentElement;
    root.classList.toggle("dark", t === "dark");
    root.classList.toggle("light", t === "light");
    root.dataset.theme = t;
    try {
      localStorage.setItem("theme", t);
    } catch {
      /* ignore */
    }
  }, theme);
}

async function overflowX(page: Page): Promise<number> {
  return page.evaluate(() =>
    Math.max(
      document.documentElement.scrollWidth - window.innerWidth,
      document.body.scrollWidth - window.innerWidth,
    ),
  );
}

async function smallInputs(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const bad: string[] = [];
    for (const el of Array.from(
      document.querySelectorAll("input, textarea, select, [role='combobox']"),
    )) {
      if (!(el instanceof HTMLElement)) continue;
      const input = el as HTMLInputElement;
      const type = (input.type || "").toLowerCase();
      // Hidden radios / checkboxes / sr-only fields are not tap targets.
      if (
        type === "hidden" ||
        type === "radio" ||
        type === "checkbox" ||
        type === "file" ||
        el.getAttribute("aria-hidden") === "true" ||
        el.classList.contains("sr-only")
      ) {
        continue;
      }
      const style = window.getComputedStyle(el);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number.parseFloat(style.opacity || "1") < 0.05
      ) {
        continue;
      }
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < 40) {
        const id =
          el.id ||
          el.getAttribute("name") ||
          el.getAttribute("role") ||
          el.tagName;
        bad.push(`${el.tagName.toLowerCase()}#${id} h=${Math.round(r.height)}`);
      }
    }
    return bad.slice(0, 8);
  });
}

async function blurLeftovers(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const bad: string[] = [];
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      if (!(el instanceof HTMLElement)) continue;
      const cls = el.className?.toString?.() ?? "";
      const style = window.getComputedStyle(el);
      if (
        /backdrop-blur|blur-sm|blur-md|blur-lg|blur-xl|blur-2xl|blur-3xl/.test(
          cls,
        ) ||
        (style.backdropFilter && style.backdropFilter !== "none") ||
        (style.filter && /\bblur\(/.test(style.filter))
      ) {
        bad.push(
          `${el.tagName.toLowerCase()}.${cls.split(/\s+/).slice(0, 3).join(".")}`,
        );
      }
    }
    return [...new Set(bad)].slice(0, 8);
  });
}

async function smallTapTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const bad: string[] = [];
    const nodes = Array.from(
      document.querySelectorAll(
        "a, button, [role='button'], summary, input[type='radio'] + *, label",
      ),
    );
    for (const el of nodes) {
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // Only flag visible interactive controls that are clearly under 40px on both axes
      // when they are primary tappable controls (buttons/links), not radio wrapper text.
      if (
        (el.tagName === "A" ||
          el.tagName === "BUTTON" ||
          el.tagName === "SUMMARY") &&
        r.height < 40 &&
        r.width > 0
      ) {
        const text = (el.textContent || "")
          .trim()
          .replace(/\s+/g, " ")
          .slice(0, 60);
        bad.push(
          `${el.tagName.toLowerCase()} h=${Math.round(r.height)} "${text}"`,
        );
      }
    }
    return bad.slice(0, 12);
  });
}

async function goldMisuseSamples(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const offenders: string[] = [];
    const all = Array.from(document.querySelectorAll("body *"));
    for (const el of all) {
      if (!(el instanceof HTMLElement)) continue;
      const cls = el.className?.toString?.() ?? "";
      const text = (el.textContent || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 80);
      // Class-based gold on non-allowlist labels
      const hasGoldClass =
        /\btext-gold\b|\bbg-gold\b|\bborder-gold\b|text-\[color:var\(--scl-gold\)\]/.test(
          cls,
        );
      if (!hasGoldClass) continue;
      const allow =
        /verified|stamp|medal|crown|to win|odds|view slip|submit|apply|become|explore|replace|rank|selected|active|pill|chip|cta|hairline|border-t.*gold-deep|gold-deep/i.test(
          cls + " " + text,
        ) ||
        el.closest("[data-selected='true'], [aria-pressed='true']") != null ||
        /Γ£ô/.test(text);
      // Eyebrows / labels that are gold but not VERIFIED stamp
      if (
        /\bscl-eyebrow\b/.test(cls) &&
        /text-gold|scl-gold/.test(cls) &&
        !/verified stamp/i.test(text)
      ) {
        offenders.push(`eyebrow gold: "${text}"`);
      } else if (
        hasGoldClass &&
        /board entry|pending|warning|public rankings/i.test(text) &&
        !allow
      ) {
        offenders.push(`gold label: "${text}"`);
      }
    }
    return [...new Set(offenders)].slice(0, 10);
  });
}

async function numericFontSamples(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const samples: string[] = [];
    const candidates = Array.from(
      document.querySelectorAll(".scl-data, .nums, [class*='tabular-nums']"),
    ).slice(0, 20);
    for (const el of candidates) {
      const fs = window.getComputedStyle(el).fontFamily;
      const text = (el.textContent || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 40);
      if (!text) continue;
      const monoish = /plex|mono|geist mono|ui-monospace|menlo|consolas/i.test(
        fs,
      );
      samples.push(
        `${monoish ? "MONO" : "NOT-MONO"} ┬╖ ${fs.split(",")[0]} ┬╖ "${text}"`,
      );
    }
    return samples.slice(0, 8);
  });
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const findings: Finding[] = [];
  const browser = await chromium.launch({ headless: true });

  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        colorScheme: theme,
      });
      const page = await context.newPage();

      for (const route of ROUTES) {
        const key = `${route.id}-${vp.id}-${theme}`;
        let status: Finding["status"] = "PASS";
        let detail = "";

        try {
          const res = await page.goto(`${BASE}${route.path}`, {
            waitUntil: "domcontentloaded",
            timeout: 45000,
          });
          await setTheme(page, theme);
          await page.waitForTimeout(800);

          // Auth-gated routes may redirect
          if (res && res.status() >= 400) {
            findings.push({
              route: route.path,
              viewport: vp.id,
              theme,
              check: "load",
              status: "FAIL",
              detail: `HTTP ${res.status()}`,
            });
            continue;
          }

          const url = page.url();
          if (
            (route.path.includes("/dashboard/") && url.includes("/login")) ||
            url.includes("/login")
          ) {
            findings.push({
              route: route.path,
              viewport: vp.id,
              theme,
              check: "auth",
              status: "SKIP",
              detail: `Redirected to login ΓÇö board/slip/Ticket live checks need a signed-in session`,
            });
            await page.screenshot({
              path: join(OUT, `${key}-login.png`),
              fullPage: true,
            });
            continue;
          }

          const ox = await overflowX(page);
          findings.push({
            route: route.path,
            viewport: vp.id,
            theme,
            check: "overflow-x",
            status: ox === 0 ? "PASS" : "FAIL",
            detail: `delta=${ox}px`,
          });

          const taps = await smallTapTargets(page);
          findings.push({
            route: route.path,
            viewport: vp.id,
            theme,
            check: "tap-targets",
            status: taps.length === 0 ? "PASS" : "WARN",
            detail: taps.length ? taps.join(" | ") : "all ΓëÑ40px height",
          });

          const inputs = await smallInputs(page);
          findings.push({
            route: route.path,
            viewport: vp.id,
            theme,
            check: "input-targets",
            status: inputs.length === 0 ? "PASS" : "FAIL",
            detail: inputs.length
              ? inputs.join(" | ")
              : "inputs/selects ≥40px height",
          });

          const blur = await blurLeftovers(page);
          findings.push({
            route: route.path,
            viewport: vp.id,
            theme,
            check: "no-blur",
            status: blur.length === 0 ? "PASS" : "FAIL",
            detail: blur.length
              ? blur.join(" | ")
              : "no blur/backdrop leftovers",
          });

          const gold = await goldMisuseSamples(page);
          findings.push({
            route: route.path,
            viewport: vp.id,
            theme,
            check: "gold-scarcity",
            status: gold.length === 0 ? "PASS" : "FAIL",
            detail: gold.length
              ? gold.join(" | ")
              : "no eyebrow/pending gold offenders",
          });

          const fonts = await numericFontSamples(page);
          const notMono = fonts.filter((f) => f.startsWith("NOT-MONO"));
          findings.push({
            route: route.path,
            viewport: vp.id,
            theme,
            check: "numeric-mono",
            status:
              fonts.length === 0 ? "WARN" : notMono.length ? "WARN" : "PASS",
            detail: fonts.join(" || ") || "no numeric samples",
          });

          await page.screenshot({
            path: join(OUT, `${key}.png`),
            fullPage: true,
          });

          // Board interactions when on pick-entry and authenticated
          if (route.id === "pick-new" || route.id === "pick-parlay") {
            const pill = page
              .locator("button", { hasText: /^NBA|^MLB|^NFL/ })
              .first();
            if (await pill.count()) {
              await pill.click().catch(() => undefined);
              await page.waitForTimeout(1200);
              const expand = page.locator("[aria-expanded='false']").first();
              if (await expand.count()) {
                await expand.click().catch(() => undefined);
                await page.waitForTimeout(800);
              }
              const chip = page
                .locator("button")
                .filter({ hasText: /[+-]\d{3}/ })
                .first();
              if (await chip.count()) {
                await chip.click().catch(() => undefined);
                await page.waitForTimeout(500);
              }
              await page.screenshot({
                path: join(OUT, `${key}-board.png`),
                fullPage: true,
              });
              findings.push({
                route: route.path,
                viewport: vp.id,
                theme,
                check: "board-interact",
                status: "PASS",
                detail: "sport pill / expand / chip attempted",
              });
            }
          }
        } catch (err) {
          status = "FAIL";
          detail = err instanceof Error ? err.message : String(err);
          findings.push({
            route: route.path,
            viewport: vp.id,
            theme,
            check: "exception",
            status,
            detail,
          });
        }
      }

      await context.close();
    }
  }

  await browser.close();

  const summary = {
    base: BASE,
    generatedAt: new Date().toISOString(),
    counts: {
      PASS: findings.filter((f) => f.status === "PASS").length,
      FAIL: findings.filter((f) => f.status === "FAIL").length,
      WARN: findings.filter((f) => f.status === "WARN").length,
      SKIP: findings.filter((f) => f.status === "SKIP").length,
    },
    findings,
    note: "Post-submit Ticket requires authenticated staging credentials ΓÇö skipped when redirected to /login.",
  };

  writeFileSync(join(OUT, "report.json"), JSON.stringify(summary, null, 2));
  const md = [
    "# Route conformance QA",
    "",
    `Base: ${BASE}`,
    `Generated: ${summary.generatedAt}`,
    "",
    `| Status | Count |`,
    `| --- | --- |`,
    `| PASS | ${summary.counts.PASS} |`,
    `| FAIL | ${summary.counts.FAIL} |`,
    `| WARN | ${summary.counts.WARN} |`,
    `| SKIP | ${summary.counts.SKIP} |`,
    "",
    "## Findings",
    "",
    ...findings.map(
      (f) =>
        `- **${f.status}** \`${f.route}\` @ ${f.viewport}px ${f.theme} ┬╖ ${f.check}: ${f.detail}`,
    ),
    "",
    summary.note,
  ].join("\n");
  writeFileSync(join(OUT, "report.md"), md);
  console.log(md);
  console.log(`\nArtifacts: ${OUT}`);
  if (summary.counts.FAIL > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
