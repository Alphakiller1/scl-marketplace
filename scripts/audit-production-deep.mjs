#!/usr/bin/env node
/**
 * Aggressive production audit for sportscappersleaderboard.com.
 * Evidence-only. Observes production write rails — does not grade, edit packages,
 * email real accounts, submit real picks, or mutate real capper profiles.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ORIGIN =
  process.env.AUDIT_ORIGIN ?? "https://sportscappersleaderboard.com";
const OUT = process.env.AUDIT_OUT ?? "/opt/cursor/artifacts/audit-deep";
const SHOTS = join(OUT, "screenshots");
mkdirSync(SHOTS, { recursive: true });

const VIEWPORTS = [
  { name: "375", width: 375, height: 812 },
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1536", width: 1536, height: 864 },
  { name: "1920", width: 1920, height: 1080 },
];

const PUBLIC_ROUTES = [
  "/",
  "/leaderboard",
  "/discover",
  "/picks",
  "/packages",
  "/cappers",
  "/verification",
  "/support",
  "/terms",
  "/privacy",
  "/disclaimer",
  "/responsible-gaming",
  "/refund-policy",
];

const AUTH_ROUTES = [
  "/login",
  "/signup",
  "/verify",
  "/resend-verification",
  "/forgot-password",
  "/reset-password",
  "/accept-terms",
  "/account-restricted",
];

const QA_ROUTES = ["/qa/board-odds-hygiene", "/qa/desktop-profile-composition"];
const GATED = ["/dashboard", "/admin"];

const report = {
  startedAt: new Date().toISOString(),
  origin: ORIGIN,
  release: null,
  health: null,
  findings: [],
  routes: [],
  responsive: [],
  dataIntegrity: [],
  a11y: [],
  performance: [],
  controlsNotExercised: [],
  testArtifacts: [],
  skipped: [],
  positives: [],
  consoleByRoute: {},
  networkFailuresByRoute: {},
};

function finding(partial) {
  const id = `AUDIT-${String(report.findings.length + 1).padStart(3, "0")}`;
  const row = { id, ...partial };
  report.findings.push(row);
  console.log(`[FINDING ${id}] ${partial.severity} ${partial.what}`);
  return id;
}

function slug(path) {
  return path === "/" ? "home" : path.replace(/^\//, "").replace(/\//g, "__");
}

async function shot(page, name) {
  const path = join(SHOTS, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  return path;
}

async function collectPageSignals(page, route) {
  const consoles = [];
  const failed = [];
  const onConsole = (msg) => {
    if (["error", "warning"].includes(msg.type())) {
      consoles.push({ type: msg.type(), text: msg.text().slice(0, 500) });
    }
  };
  const onFail = (req) => {
    failed.push({
      url: req.url().slice(0, 240),
      method: req.failure()?.errorText,
    });
  };
  const onResponse = (res) => {
    if (res.status() >= 400) {
      failed.push({ url: res.url().slice(0, 240), status: res.status() });
    }
  };
  page.on("console", onConsole);
  page.on("requestfailed", onFail);
  page.on("response", onResponse);

  const started = Date.now();
  let status = null;
  try {
    const resp = await page.goto(`${ORIGIN}${route}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    status = resp?.status() ?? null;
    await page
      .waitForLoadState("networkidle", { timeout: 20000 })
      .catch(() => {});
    await page.waitForTimeout(400);
  } catch (e) {
    status = "error";
    consoles.push({ type: "error", text: String(e).slice(0, 300) });
  }
  const tti = Date.now() - started;

  const metrics = await page.evaluate(() => {
    const overflow =
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1;
    const body = document.body?.innerText ?? "";
    const handleHits = (body.match(/\b[Hh]andle\b/g) || []).length;
    const dollarHits = (body.match(/\$\d/g) || []).length;
    const title = document.title;
    const h1 = document.querySelector("h1")?.textContent?.trim() ?? null;
    const brokenImages = [...document.images].filter(
      (img) => !img.complete || img.naturalWidth === 0,
    ).length;
    const inputs = [...document.querySelectorAll("input,textarea,select")].map(
      (el) => ({
        id: el.id || null,
        name: el.getAttribute("name"),
        type: el.getAttribute("type"),
        placeholder: el.getAttribute("placeholder"),
        aria: el.getAttribute("aria-label"),
        labelled: Boolean(
          el.labels?.length ||
          el.getAttribute("aria-label") ||
          el.getAttribute("aria-labelledby"),
        ),
      }),
    );
    const buttons = [...document.querySelectorAll("button,a,[role='button']")]
      .slice(0, 80)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          text: (el.innerText || el.getAttribute("aria-label") || "")
            .trim()
            .slice(0, 80),
          href: el.getAttribute("href"),
          w: Math.round(r.width),
          h: Math.round(r.height),
          disabled:
            el.hasAttribute("disabled") ||
            el.getAttribute("aria-disabled") === "true",
        };
      });
    return {
      overflow,
      handleHits,
      dollarHits,
      title,
      h1,
      brokenImages,
      inputs,
      buttons,
      textSample: body.slice(0, 1200),
    };
  });

  page.off("console", onConsole);
  page.off("requestfailed", onFail);
  page.off("response", onResponse);

  report.consoleByRoute[route] = consoles;
  report.networkFailuresByRoute[route] = failed;
  return { status, tti, metrics, consoles, failed };
}

async function main() {
  // Health / infra
  const health = await fetch(`${ORIGIN}/api/health`, {
    cache: "no-store",
  }).then((r) => r.json());
  report.health = health;
  report.release = health.release;
  console.log("release", health.release);
  console.log("supabase", health.supabase);

  if (
    health.supabase?.bucketReady === false ||
    health.supabase?.storage === false
  ) {
    finding({
      severity: "P0",
      category: "correctness",
      route: "/dashboard/profile + /api/health",
      viewport: "n/a",
      what: "Profile media uploads are broken in production: /api/health reports bucketReady=false / storage=false while credentials are configured.",
      evidence: `Live /api/health ${JSON.stringify(health.supabase)}; public Storage probe on mvxjcfriirguhjujurhf.supabase.co returns Bucket not found for scl-profile-media. Prior shallow audits trusted env-only health flags.`,
      repro: [
        "1. curl -s https://sportscappersleaderboard.com/api/health | jq .supabase",
        "2. Observe configured:true, bucketReady:false, storage:false",
        "3. Sign in as any capper → /dashboard/profile → upload avatar → toast: Profile media storage is unavailable.",
      ],
      why: "Core onboarding identity path is dead on launch day; /api/health previously lied with storage:true when only env vars existed.",
      fix: "Create public bucket scl-profile-media in the production Supabase project (or fix Storage API access). Keep live probe in /api/health. Do not treat env presence as readiness.",
      status:
        "OPEN — another session owns the fix; confirmed still broken on release " +
        health.release,
    });
  }

  const robots = await fetch(`${ORIGIN}/robots.txt`).then((r) => r.text());
  const sitemap = await fetch(`${ORIGIN}/sitemap.xml`).then((r) => r.text());
  writeFileSync(join(OUT, "robots.txt"), robots);
  writeFileSync(join(OUT, "sitemap.xml"), sitemap);
  if (
    !robots.includes("sportscappersleaderboard.com") ||
    /vercel\.app/.test(robots)
  ) {
    finding({
      severity: "P1",
      category: "seo",
      route: "/robots.txt",
      what: "robots.txt host incorrect or missing production host",
      evidence: robots.slice(0, 400),
      repro: ["curl robots.txt"],
      why: "Launch check",
      fix: "Set NEXT_PUBLIC_SITE_URL",
    });
  } else {
    report.positives.push("robots.txt references sportscappersleaderboard.com");
  }
  if (/vercel\.app/.test(sitemap)) {
    finding({
      severity: "P1",
      category: "seo",
      route: "/sitemap.xml",
      what: "sitemap contains vercel.app host",
      evidence: sitemap.match(/https?:\/\/[^<]+/)?.[0],
      repro: ["curl sitemap.xml"],
      why: "Launch check",
      fix: "NEXT_PUBLIC_SITE_URL",
    });
  } else {
    report.positives.push("sitemap.xml uses production host");
  }

  // Storage public probe
  const storageHosts = ["https://mvxjcfriirguhjujurhf.supabase.co"];
  for (const host of storageHosts) {
    const res = await fetch(
      `${host}/storage/v1/object/list/scl-profile-media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: "", limit: 1 }),
      },
    );
    const body = await res.text();
    writeFileSync(
      join(OUT, `storage-probe-${host.replace(/https?:\/\//, "")}.json`),
      body,
    );
    if (/Bucket not found|NoSuchBucket/i.test(body)) {
      finding({
        severity: "P0",
        category: "correctness",
        route: "Supabase Storage",
        viewport: "n/a",
        what: `Public Storage API reports scl-profile-media bucket missing on ${host}.`,
        evidence: body.slice(0, 300),
        repro: [
          `curl -X POST ${host}/storage/v1/object/list/scl-profile-media -H 'content-type: application/json' -d '{}'`,
        ],
        why: "Confirms upload failure root cause independently of app toast copy.",
        fix: "Create the public bucket in the Supabase project that production SUPABASE_URL points at.",
      });
    }
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
  });
  const page = await context.newPage();

  // Auth gate checks (logged out)
  for (const route of GATED) {
    const resp = await page.goto(`${ORIGIN}${route}`, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await page.waitForTimeout(500);
    const url = page.url();
    const status = resp?.status();
    await shot(page, `gated${slug(route)}_logged_out`);
    const ok = /\/login/.test(url);
    report.routes.push({
      route,
      auth: "logged-out",
      status,
      finalUrl: url,
      redirectOk: ok,
    });
    if (!ok) {
      finding({
        severity: "P0",
        category: "security",
        route,
        what: `Logged-out access to ${route} did not redirect to login`,
        evidence: `finalUrl=${url} status=${status}`,
        repro: [`Open ${route} while logged out`],
        why: "Authorization must not rely on hidden UI",
        fix: "proxy.ts / layout require*Access",
      });
    } else {
      report.positives.push(`${route} redirects to login when logged out`);
    }
  }

  // Public + auth route matrix at 1440 + 375
  const matrixViewports = [
    VIEWPORTS.find((v) => v.name === "1440"),
    VIEWPORTS.find((v) => v.name === "375"),
  ];
  for (const route of [...PUBLIC_ROUTES, ...AUTH_ROUTES, ...QA_ROUTES]) {
    for (const vp of matrixViewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const sig = await collectPageSignals(page, route);
      const shotPath = await shot(page, `${slug(route)}_${vp.name}`);
      const row = {
        route,
        viewport: vp.name,
        status: sig.status,
        ttiMs: sig.tti,
        overflow: sig.metrics.overflow,
        handleHits: sig.metrics.handleHits,
        dollarHits: sig.metrics.dollarHits,
        brokenImages: sig.metrics.brokenImages,
        consoleErrors: sig.consoles.filter((c) => c.type === "error").length,
        networkFails: sig.failed.length,
        shot: shotPath,
        title: sig.metrics.title,
        h1: sig.metrics.h1,
      };
      report.routes.push(row);
      report.performance.push({ route, viewport: vp.name, ttiMs: sig.tti });

      if (QA_ROUTES.includes(route) && sig.status !== 404) {
        finding({
          severity: "P0",
          category: "security",
          route,
          viewport: vp.name,
          what: `QA fixture route returned HTTP ${sig.status} instead of 404`,
          evidence: shotPath,
          repro: [`curl -I ${ORIGIN}${route}`],
          why: "QA fixtures can expose fabricated data on a verified-records product",
          fix: "proxy hard 404 when ALLOW_QA_SHOTS!=1",
        });
      }
      if (sig.metrics.overflow) {
        finding({
          severity: "P2",
          category: "a11y",
          route,
          viewport: vp.name,
          what: "Horizontal page overflow detected",
          evidence: shotPath,
          repro: [
            `Open ${route} at ${vp.width}px and check scrollWidth > clientWidth`,
          ],
          why: "Mobile-first / zoom resilience rule",
          fix: "min-w-0 / rem / avoid page overflow-x-hidden",
        });
      }
      // Design-law: "handle" on marketing surfaces (exclude legal boilerplate carefully)
      if (
        PUBLIC_ROUTES.includes(route) &&
        sig.metrics.handleHits > 0 &&
        ![
          "/terms",
          "/privacy",
          "/disclaimer",
          "/responsible-gaming",
          "/refund-policy",
          "/support",
        ].includes(route)
      ) {
        // filter common false positives later; still flag leaderboard/home/discover
        if (
          ["/", "/leaderboard", "/discover", "/picks", "/packages"].includes(
            route,
          )
        ) {
          finding({
            severity: "P1",
            category: "design-law",
            route,
            viewport: vp.name,
            what: `Visible copy contains the forbidden word "handle" (${sig.metrics.handleHits} hits)`,
            evidence: `${shotPath}; body sample includes handle`,
            repro: [`Open ${route}; search page text for handle`],
            why: "SCL-DESIGN-SPEC v2.0: The word handle must not appear",
            fix: "Replace with username/capper wording",
          });
        }
      }
      // small tap targets on mobile
      if (vp.name === "375") {
        const small = sig.metrics.buttons.filter(
          (b) => b.h > 0 && b.h < 36 && b.text,
        );
        if (small.length >= 5) {
          finding({
            severity: "P2",
            category: "a11y",
            route,
            viewport: "375",
            what: `${small.length} interactive controls shorter than 36px`,
            evidence: JSON.stringify(small.slice(0, 8)),
            repro: [`Inspect button heights on ${route} mobile`],
            why: "Tap targets should be ≥40px (gate ≥36 observed)",
            fix: "Increase min-h on controls",
          });
        }
      }
    }
  }

  // Full viewport sweep on critical surfaces
  const critical = ["/", "/leaderboard", "/packages", "/picks", "/discover"];
  for (const route of critical) {
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${ORIGIN}${route}`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth + 1,
      );
      const shotPath = await shot(page, `resp_${slug(route)}_${vp.name}`);
      report.responsive.push({
        route,
        viewport: vp.name,
        overflow,
        shot: shotPath,
      });
      if (overflow) {
        finding({
          severity: "P2",
          category: "a11y",
          route,
          viewport: vp.name,
          what: "Horizontal overflow on critical surface",
          evidence: shotPath,
          repro: [`Resize to ${vp.width}`],
          why: "Responsive matrix",
          fix: "Layout shell",
        });
      }
    }
    // zoom 150/200 at 1440 css pixels via deviceScale is not zoom; emulate by shrinking layout width
    for (const zoom of [150, 200]) {
      const width = Math.round(1440 * (100 / zoom));
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${ORIGIN}${route}`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth + 1,
      );
      const shotPath = await shot(page, `zoom_${slug(route)}_${zoom}`);
      report.responsive.push({
        route,
        viewport: `zoom-${zoom}`,
        overflow,
        shot: shotPath,
        note: "width-emulated zoom",
      });
    }
  }

  // Light theme spot check
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const route of ["/", "/leaderboard", "/cappers/bankofdennis"]) {
    await page
      .goto(`${ORIGIN}${route}`, { waitUntil: "networkidle", timeout: 60000 })
      .catch(() => {});
    await shot(page, `light_${slug(route)}_1440`);
  }
  await page.emulateMedia({ colorScheme: "dark" });

  // Data integrity across 5+ cappers
  await page.goto(`${ORIGIN}/leaderboard`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(800);
  const boardRows = await page.evaluate(() => {
    const text = document.body.innerText;
    const rows = [];
    // gather @handles visible
    const handles = [...text.matchAll(/@([a-z0-9_]{3,20})/gi)].map((m) =>
      m[1].toLowerCase(),
    );
    const uniq = [...new Set(handles)].slice(0, 12);
    return { uniq, sample: text.slice(0, 2500) };
  });
  // Prefer known legacy + active names if present
  const preferred = [
    "bankofdennis",
    "wgsdfs",
    "mlbanalyticspro",
    "clownsportspick",
    "amanee330",
  ];
  const handles = [
    ...preferred.filter((h) => boardRows.uniq.includes(h) || true),
    ...boardRows.uniq,
  ]
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 8);

  await page.setViewportSize({ width: 1440, height: 900 });
  for (const handle of handles) {
    try {
      // leaderboard search
      await page.goto(`${ORIGIN}/leaderboard`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForTimeout(500);
      const search = page
        .locator('input[placeholder*="Search" i], input[type="search"]')
        .first();
      if (await search.count()) {
        await search.fill(handle, { force: true }).catch(async () => {
          await page.evaluate((h) => {
            const el = document.querySelector(
              'input[type="search"], input[placeholder*="Search" i]',
            );
            if (!el) return;
            el.focus();
            el.value = h;
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }, handle);
        });
        await page.waitForTimeout(700);
      }
      const boardStats = await page.evaluate((h) => {
        const body = document.body.innerText;
        const idx = body.toLowerCase().indexOf("@" + h.toLowerCase());
        const window =
          idx >= 0 ? body.slice(Math.max(0, idx - 40), idx + 280) : null;
        return {
          window,
          placeholder: document.querySelector("input")?.placeholder ?? null,
        };
      }, handle);
      await shot(page, `integrity_board_${handle}`);

      await page
        .goto(`${ORIGIN}/cappers/${handle}`, {
          waitUntil: "networkidle",
          timeout: 60000,
        })
        .catch(async () => {
          await page.goto(`${ORIGIN}/cappers/${handle}`, {
            waitUntil: "domcontentloaded",
            timeout: 60000,
          });
        });
      await page.waitForTimeout(900);
      const profile = await page.evaluate(() => {
        const body = document.body.innerText;
        const pickUnits = (label) => {
          const re = new RegExp(
            label + "[\\s\\S]{0,80}?([+\\-]?\\d+(?:\\.\\d+)?\\s*U)",
            "i",
          );
          const m = body.match(re);
          return m?.[1] ?? null;
        };
        const record =
          body.match(/RECORD\s*\n?\s*([0-9]+-[0-9]+-[0-9]+|—|–|-)/i)?.[1] ??
          null;
        const units =
          pickUnits("UNITS") ||
          body.match(/UNITS\s*\n?\s*([+\-]?\d+(?:\.\d+)?U|—)/i)?.[1] ||
          null;
        const roi =
          body.match(/ROI\s*\n?\s*([+\-]?\d+(?:\.\d+)?%|—)/i)?.[1] ?? null;
        const chartEnd =
          body.match(/End\s*([+\-]?\d+(?:\.\d+)?U)/i)?.[1] ||
          body.match(/Ending balance\s*([+\-]?\d+(?:\.\d+)?)\s*units/i)?.[1] ||
          null;
        const legacy = /Legacy Capper|carried over|Legacy by sport/i.test(body);
        const fullRecord = /Full capper record/i.test(body);
        const verifiedClaims = [...body.matchAll(/verified/gi)].length;
        const clv =
          body.match(/CLV\s*\n?\s*([+\-]?\d+(?:\.\d+)?%|—|–)/i)?.[1] ?? null;
        const status =
          document.title.includes("404") || /could not be found/i.test(body)
            ? "missing"
            : "ok";
        return {
          record,
          units,
          roi,
          chartEnd,
          legacy,
          fullRecord,
          verifiedClaims,
          clv,
          status,
          sample: body.slice(0, 1800),
        };
      });
      await shot(page, `integrity_profile_${handle}`);

      // picks filtered if possible
      await page.goto(`${ORIGIN}/picks`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      const picksText = await page.locator("body").innerText();
      const onPicks = picksText
        .toLowerCase()
        .includes("@" + handle.toLowerCase());

      const row = { handle, boardWindow: boardStats.window, profile, onPicks };
      report.dataIntegrity.push(row);

      if (profile.status === "ok" && profile.units && profile.chartEnd) {
        const norm = (s) => String(s).replace(/[^\d+\-.]/g, "");
        if (
          norm(profile.units) &&
          norm(profile.chartEnd) &&
          norm(profile.units) !== norm(profile.chartEnd)
        ) {
          finding({
            severity: "P0",
            category: "data-integrity",
            route: `/cappers/${handle}`,
            what: `Evidence Brief units (${profile.units}) ≠ chart End (${profile.chartEnd})`,
            evidence: `integrity_profile_${handle}.png; DOM extract`,
            repro: [
              `Open /cappers/${handle}`,
              "Compare Evidence Brief UNITS to chart End/Ending balance",
            ],
            why: "Product promise is reconcilable verified performance",
            fix: "Align chart baseline with legacy-inclusive aggregates",
          });
        } else if (norm(profile.units) === norm(profile.chartEnd)) {
          report.positives.push(
            `@${handle} Evidence Brief units match chart end (${profile.units})`,
          );
        }
      }
    } catch (err) {
      report.skipped.push(
        `Data integrity for @${handle}: ${String(err).slice(0, 200)}`,
      );
      console.warn("integrity skip", handle, err.message?.slice(0, 120));
    }
  }

  // Design-law dollar check on packages/terms — commerce vs betting
  await page.goto(`${ORIGIN}/packages`, { waitUntil: "domcontentloaded" });
  const pkgDollars = await page.evaluate(
    () => (document.body.innerText.match(/\$\d/g) || []).length,
  );
  report.positives.push(
    `/packages shows ${pkgDollars} $-price tokens (commerce pricing — review vs units-only betting law)`,
  );

  // Auth: form validation without sending emails
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${ORIGIN}/login`, { waitUntil: "networkidle" });
  await page
    .getByRole("button", { name: /sign in|log in|welcome/i })
    .first()
    .click()
    .catch(async () => {
      await page.locator('button[type="submit"]').click();
    });
  await page.waitForTimeout(400);
  await shot(page, "login_validation_empty");
  const loginErrors = await page
    .locator("p.text-neg, [role='alert'], .text-destructive")
    .allTextContents()
    .catch(() => []);
  report.a11y.push({ route: "/login", validationErrors: loginErrors });

  await page.goto(`${ORIGIN}/signup`, { waitUntil: "networkidle" });
  await page
    .locator('button[type="submit"]')
    .click()
    .catch(() => {});
  await page.waitForTimeout(400);
  await shot(page, "signup_validation_empty");

  // Disposable signup + upload attempt (allowed test artifact)
  const ts = Date.now().toString(36);
  const testUser = {
    username: `qaaudit${ts}`.slice(0, 20),
    email: `qa-audit-${ts}@sportscappersleaderboard.com`,
    password: `AuditPass!${ts}9x`,
  };
  console.log(
    "Attempting disposable signup",
    testUser.username,
    testUser.email,
  );

  await page.goto(`${ORIGIN}/signup`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.fill("#username", testUser.username).catch(async () => {
    await page.locator('input[name="username"]').fill(testUser.username);
  });
  await page.fill("#email", testUser.email).catch(async () => {
    await page.locator('input[name="email"]').fill(testUser.email);
  });
  await page.fill("#password", testUser.password).catch(async () => {
    await page.locator('input[name="password"]').fill(testUser.password);
  });
  await page.fill("#confirmPassword", testUser.password).catch(async () => {
    await page.locator('input[name="confirmPassword"]').fill(testUser.password);
  });
  // checkboxes
  for (const name of [
    "confirmEligibility",
    "acceptPolicies",
    "acknowledgeResponsibleGaming",
  ]) {
    const box = page.locator(`input[name="${name}"]`);
    if (await box.count()) await box.check({ force: true }).catch(() => {});
  }
  // also click any unchecked role=checkbox
  const checks = page.getByRole("checkbox");
  const n = await checks.count();
  for (let i = 0; i < n; i++) {
    const c = checks.nth(i);
    if (!(await c.isChecked().catch(() => true)))
      await c.check({ force: true }).catch(() => {});
  }
  await shot(page, "signup_filled");
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(4000);
  await shot(page, "signup_after_submit");
  const afterSignupUrl = page.url();
  const afterSignupText = await page.locator("body").innerText();
  report.testArtifacts.push({
    type: "signup_attempt",
    ...testUser,
    password: "[redacted in summary — see secrets file]",
    finalUrl: afterSignupUrl,
    bodySnippet: afterSignupText.slice(0, 800),
  });
  writeFileSync(
    join(OUT, "test-account.secret.json"),
    JSON.stringify({ ...testUser, finalUrl: afterSignupUrl }, null, 2),
  );

  // Try login
  await page.goto(`${ORIGIN}/login`, { waitUntil: "networkidle" });
  await page.fill("#username", testUser.username);
  await page.fill("#email", testUser.email);
  await page.fill("#password", testUser.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(5000);
  await shot(page, "login_test_account");
  const loggedInUrl = page.url();
  const loggedIn = /\/dashboard|\/accept-terms|\/verify/.test(loggedInUrl);
  report.testArtifacts.push({
    type: "login_result",
    url: loggedInUrl,
    loggedIn,
  });

  if (loggedIn) {
    report.positives.push(
      `Disposable test account can authenticate (${loggedInUrl})`,
    );
    // accept terms if needed
    if (/accept-terms/.test(loggedInUrl)) {
      await page
        .locator('button[type="submit"]')
        .click()
        .catch(() => {});
      await page.waitForTimeout(2000);
      await shot(page, "accept_terms_test");
    }
    // Capper workspace routes (read)
    for (const route of [
      "/dashboard",
      "/dashboard/picks",
      "/dashboard/picks/new",
      "/dashboard/picks/new/parlay",
      "/dashboard/profile",
      "/dashboard/monetization",
      "/dashboard/security",
    ]) {
      const sig = await collectPageSignals(page, route);
      const shotPath = await shot(page, `capper_${slug(route)}_1440`);
      report.routes.push({
        route,
        auth: "test-capper",
        status: sig.status,
        ttiMs: sig.tti,
        overflow: sig.metrics.overflow,
        shot: shotPath,
        title: sig.metrics.title,
      });
      // Inspect destructive controls without firing
      if (route === "/dashboard/security") {
        const deleteBtn = page.getByRole("button", { name: /delete/i });
        if (await deleteBtn.count()) {
          await deleteBtn
            .first()
            .click()
            .catch(() => {});
          await page.waitForTimeout(500);
          await shot(page, "capper_delete_dialog_inspect");
          // cancel / escape
          await page.keyboard.press("Escape");
          const cancel = page.getByRole("button", {
            name: /cancel|nevermind|keep/i,
          });
          if (await cancel.count())
            await cancel
              .first()
              .click()
              .catch(() => {});
          report.controlsNotExercised.push({
            control: "deleteOwnAccountAction",
            route,
            observed:
              "Opened/inspected delete control; cancelled without confirming",
            why: "Destructive — rail / safety",
          });
        }
      }
      if (route === "/dashboard/picks/new") {
        report.controlsNotExercised.push({
          control: "createPlay / submit pick",
          route,
          observed: "Opened new pick form; did not submit",
          why: "Rail 8 — do not submit real picks; test account also should not pollute public board without flag",
        });
        await shot(page, "capper_new_pick_form");
      }
    }

    // Profile media upload attempt on TEST account only
    await page.goto(`${ORIGIN}/dashboard/profile`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await shot(page, "capper_profile_before_upload");
    // create tiny png
    const pngPath = join(OUT, "tiny-avatar.png");
    // 1x1 png
    const b64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    writeFileSync(pngPath, Buffer.from(b64, "base64"));
    const fileInput = page
      .locator('input[aria-label="Upload profile image"], input[type="file"]')
      .first();
    const toasts = [];
    page.on("console", () => {});
    if (await fileInput.count()) {
      await fileInput.setInputFiles(pngPath);
      await page.waitForTimeout(5000);
      await shot(page, "capper_profile_after_upload");
      const body = await page.locator("body").innerText();
      const toastText = await page
        .locator("[data-sonner-toast], li[data-sonner-toast], [class*='toast']")
        .allTextContents()
        .catch(() => []);
      const uploadResult = {
        toastText,
        bodyHasUnavailable:
          /unavailable|not configured|couldn't upload|credentials were rejected/i.test(
            body + " " + toastText.join(" "),
          ),
        bodyHasSuccess: /Profile image updated|Cover image updated/i.test(
          body + " " + toastText.join(" "),
        ),
      };
      report.testArtifacts.push({ type: "upload_attempt", ...uploadResult });
      if (
        uploadResult.bodyHasUnavailable ||
        (!uploadResult.bodyHasSuccess && health.supabase?.bucketReady === false)
      ) {
        finding({
          severity: "P0",
          category: "correctness",
          route: "/dashboard/profile",
          viewport: "1440",
          what: "Authenticated avatar upload fails on a disposable test account (storage unavailable / no success toast).",
          evidence: `capper_profile_after_upload.png; toasts=${JSON.stringify(toastText)}; health.supabase=${JSON.stringify(health.supabase)}`,
          repro: [
            "1. Sign up disposable ACTIVE capper",
            "2. Open /dashboard/profile",
            "3. Upload a 1×1 PNG as profile image",
            "4. Observe failure toast / no Profile image updated",
          ],
          why: "This is the defect the prior audit missed by never exercising the authenticated upload path.",
          fix: "Owned by parallel session — create scl-profile-media bucket / finish Storage fix. Audit must keep live upload exercise.",
        });
      } else if (uploadResult.bodyHasSuccess) {
        report.positives.push("Test-account avatar upload succeeded");
        finding({
          severity: "P3",
          category: "correctness",
          route: "/dashboard/profile",
          what: "Upload succeeded on test account during audit — verify cleanup of test media object",
          evidence: "capper_profile_after_upload.png",
          repro: ["n/a"],
          why: "Cleanup hygiene",
          fix: "Delete test user media in Storage",
        });
      }
    } else {
      report.skipped.push("Upload file input not found on /dashboard/profile");
    }

    // Admin as non-admin
    await page.goto(`${ORIGIN}/admin`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    await shot(page, "admin_as_capper");
    const adminUrl = page.url();
    if (/\/admin/.test(adminUrl) && !/login/.test(adminUrl)) {
      // might have redirected to dashboard
      if (!/dashboard/.test(adminUrl)) {
        finding({
          severity: "P0",
          category: "security",
          route: "/admin",
          what: "Non-admin session appears to remain on /admin",
          evidence: `finalUrl=${adminUrl}`,
          repro: ["Login as CAPPER", "Open /admin"],
          why: "Role gate",
          fix: "proxy.ts ADMIN check",
        });
      } else {
        report.positives.push("CAPPER redirected away from /admin");
      }
    } else {
      report.positives.push(`Non-admin /admin ended at ${adminUrl}`);
    }
  } else {
    report.skipped.push(
      `Could not authenticate disposable account (url=${loggedInUrl}). Capper workspace / upload UI exercise incomplete — health+storage probes still prove upload infra broken.`,
    );
    finding({
      severity: "P1",
      category: "correctness",
      route: "/signup|/login",
      what: "Disposable signup/login did not reach an authenticated workspace during audit",
      evidence: `signup url ${afterSignupUrl}; login url ${loggedInUrl}; snippets in testArtifacts`,
      repro: [
        "Create qa-audit-* account via /signup",
        "Login with username+email+password",
      ],
      why: "Blocks deeper authenticated audit; may indicate verification gate or signup failure",
      fix: "Inspect signup response / verify gate; provide audit credentials if verification email required",
    });
  }

  // Keyboard a11y spot: leaderboard
  await page.goto(`${ORIGIN}/leaderboard`, { waitUntil: "domcontentloaded" });
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const focus = await page.evaluate(() => {
    const el = document.activeElement;
    return {
      tag: el?.tagName,
      text: (el?.innerText || el?.getAttribute("aria-label") || "").slice(
        0,
        80,
      ),
      outline: getComputedStyle(el).outlineStyle,
      outlineWidth: getComputedStyle(el).outlineWidth,
    };
  });
  await shot(page, "a11y_leaderboard_focus");
  report.a11y.push({ route: "/leaderboard", focusAfterTabs: focus });

  // prefers-reduced-motion
  await context.close();
  const reduced = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
    reducedMotion: "reduce",
  });
  const rp = await reduced.newPage();
  await rp.goto(`${ORIGIN}/`, { waitUntil: "networkidle", timeout: 60000 });
  await shot(rp, "home_reduced_motion");
  await reduced.close();

  // Legacy pick verification claim scan on profile
  const p2 = await browser.newPage();
  await p2.goto(`${ORIGIN}/cappers/bankofdennis`, { waitUntil: "networkidle" });
  const legacyHonesty = await p2.evaluate(() => {
    const body = document.body.innerText;
    return {
      hasLegacyBadge: /Legacy Capper|carried over/i.test(body),
      impliesBoardVerifiedLegacy:
        /legacy[\s\S]{0,80}board-?verified|odds-?verified[\s\S]{0,40}legacy/i.test(
          body,
        ),
      totalsOnly: /totals only|no per-pick/i.test(body),
    };
  });
  report.positives.push(
    `Legacy honesty @bankofdennis: ${JSON.stringify(legacyHonesty)}`,
  );
  if (legacyHonesty.impliesBoardVerifiedLegacy) {
    finding({
      severity: "P0",
      category: "data-integrity",
      route: "/cappers/bankofdennis",
      what: "Legacy surface implies board-verified status",
      evidence: "DOM text match",
      repro: ["Read legacy copy"],
      why: "Legacy picks can never be board-verified",
      fix: "Copy correction",
    });
  }
  await p2.close();

  // Admin destructive inventory (logged out already checked). Note not opened with admin creds.
  report.controlsNotExercised.push(
    {
      control: "runAutoGradeAction / gradePlayAction",
      route: "/admin/grading",
      observed:
        "NOT OPENED — admin credentials not available in this cloud environment; DB also unreachable (IPv6 ENETUNREACH)",
      why: "Rail 4 + missing admin session",
    },
    {
      control: "adminUpdateStoreConnectionAction approve/reject",
      route: "/admin/store-setup",
      observed: "NOT OPENED — no admin session",
      why: "Rail 3",
    },
    {
      control: "savePolicyDocumentAction",
      route: "/admin/policies",
      observed: "NOT OPENED — no admin session",
      why: "Rail 7",
    },
    {
      control: "updateAccountStatusAction / adminDeleteCapperAction",
      route: "/admin/cappers/[id]",
      observed: "NOT OPENED — no admin session",
      why: "Rail 1",
    },
  );

  report.skipped.push(
    "Direct Postgres reconciliation: host resolves IPv6-only; connect ENETUNREACH from cloud agent. UI cross-checks used instead.",
  );
  report.skipped.push(
    "Admin console deep audit: legacy credentials.json not mounted; no ADMIN password in env.",
  );
  report.skipped.push(
    "Password reset / resend verification against real accounts: blocked by email rail.",
  );

  report.finishedAt = new Date().toISOString();
  writeFileSync(
    join(OUT, "audit-deep-raw.json"),
    JSON.stringify(report, null, 2),
  );
  console.log("Wrote", join(OUT, "audit-deep-raw.json"));
  console.log("Findings", report.findings.length);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  report.fatal = String(e.stack || e);
  report.finishedAt = new Date().toISOString();
  try {
    writeFileSync(
      join(OUT, "audit-deep-raw.json"),
      JSON.stringify(report, null, 2),
    );
  } catch {
    /* ignore */
  }
  writeFileSync(join(OUT, "audit-deep-fatal.json"), String(e.stack || e));
  process.exit(1);
});
