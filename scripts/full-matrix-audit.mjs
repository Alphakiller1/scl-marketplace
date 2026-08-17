/**
 * End-to-end visual matrix + defect audit.
 *
 * Walks every route across viewports x themes and records machine-checkable
 * defects: console/page errors, failed same-origin requests, horizontal
 * overflow, undersized tap targets and inputs, unlabelled controls, broken
 * images, duplicate ids, heading-order skips, and unpainted theme surfaces.
 *
 *   ALLOW_QA_SHOTS=1 npm run start
 *   node scripts/full-matrix-audit.mjs
 *
 * Plain .mjs on purpose, like the other browser scripts here: tsx/esbuild runs
 * with keepNames, which injects a `__name` helper into any named function it
 * transpiles. Serialize such a function into page.evaluate and it throws
 * `__name is not defined` inside the browser, where the helper does not exist.
 *
 * AUDIT_ROUTES=public|gated|all   (default all; gated needs a signed-in session)
 * AUDIT_STORAGE=<path>            Playwright storageState for gated routes
 * AUDIT_SHOTS=1                   also write full-page screenshots
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const OUT = join(process.cwd(), "tmp", "matrix-audit");
const WANT_SHOTS = process.env.AUDIT_SHOTS === "1";

const ROUTES = [
  { path: "/", group: "public" },
  { path: "/leaderboard", group: "public" },
  { path: "/discover", group: "public" },
  { path: "/picks", group: "public" },
  { path: "/packages", group: "public" },
  { path: "/verification", group: "public" },
  { path: "/support", group: "public" },
  { path: "/terms", group: "public" },
  { path: "/privacy", group: "public" },
  { path: "/disclaimer", group: "public" },
  { path: "/refund-policy", group: "public" },
  { path: "/responsible-gaming", group: "public" },
  { path: "/login", group: "auth" },
  { path: "/signup", group: "auth" },
  { path: "/forgot-password", group: "auth" },
  { path: "/reset-password", group: "auth" },
  { path: "/resend-verification", group: "auth" },
  { path: "/account-restricted", group: "auth" },
  { path: "/qa/board-odds-hygiene", group: "qa" },
  { path: "/qa/live-ticker", group: "qa" },
  { path: "/qa/desktop-profile-composition", group: "qa" },
  { path: "/dashboard", group: "capper" },
  { path: "/dashboard/picks", group: "capper" },
  { path: "/dashboard/picks/new", group: "capper" },
  { path: "/dashboard/picks/new/parlay", group: "capper" },
  { path: "/dashboard/profile", group: "capper" },
  { path: "/dashboard/security", group: "capper" },
  { path: "/dashboard/monetization", group: "capper" },
  { path: "/admin", group: "admin" },
  { path: "/admin/plays", group: "admin" },
  { path: "/admin/grading", group: "admin" },
  { path: "/admin/cappers", group: "admin" },
  { path: "/admin/store-setup", group: "admin" },
  { path: "/admin/policies", group: "admin" },
  { path: "/admin/messages", group: "admin" },
];

const VIEWPORTS = [
  { id: "375", width: 375, height: 812 },
  { id: "768", width: 768, height: 1024 },
  { id: "1280", width: 1280, height: 900 },
];

const THEMES = ["dark", "light"];

const findings = [];
function add(f) {
  findings.push(f);
}

/**
 * Console noise that is a property of the audit environment, not the product.
 * Kept explicit so a real console error can never hide behind a broad filter.
 */
const IGNORED_CONSOLE =
  /Download the React DevTools|the server responded with a status of 40[34]|favicon/i;

async function setTheme(page, theme) {
  await page.emulateMedia({ colorScheme: theme });
  await page.evaluate((t) => {
    const root = document.documentElement;
    root.classList.toggle("dark", t === "dark");
    root.classList.toggle("light", t === "light");
    root.dataset.theme = t;
    try {
      localStorage.setItem("theme", t);
    } catch {
      /* storage blocked */
    }
  }, theme);
}

async function domChecks(page) {
  return page.evaluate(() => {
    /**
     * Visibility has to walk ancestors, not just the element.
     *
     * opacity is a rendering effect, not an inherited style: a carousel that
     * stacks slides and fades the inactive ones sets `opacity-0` and
     * `aria-hidden` on the slide WRAPPER, and getComputedStyle on the <h1>
     * inside still reports opacity 1. Checking only the element reported the
     * home hero as three visible h1s when one is on screen.
     */
    const isVisible = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      for (let n = el; n; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (s.display === "none" || s.visibility === "hidden") return false;
        if (Number.parseFloat(s.opacity || "1") < 0.05) return false;
        if (n.getAttribute("aria-hidden") === "true") return false;
        if (n.hasAttribute("inert")) return false;
      }
      return true;
    };

    /**
     * WCAG 2.5.5 exempts a target "in a sentence or block of text". An email
     * address inside a policy paragraph is not a sizing defect, and flagging
     * every one of them buries the real undersized buttons.
     */
    const isInlineInProse = (el) => {
      if (el.tagName !== "A") return false;
      const block = el.closest("p, li, td, dd, blockquote, figcaption");
      if (!block) return false;
      const own = (el.textContent || "").trim().length;
      const around = (block.textContent || "").trim().length;
      // Any surrounding copy in the same block makes it a link in a sentence.
      // A character threshold here was too blunt: "Remembered it? Return to
      // login" is plainly prose and a +20 margin still reported it.
      return around > own;
    };
    const nameOf = (el) =>
      (
        el.getAttribute("aria-label") ||
        el.getAttribute("title") ||
        el.textContent ||
        ""
      )
        .trim()
        .replace(/\s+/g, " ");

    const overflowX = Math.max(
      document.documentElement.scrollWidth - window.innerWidth,
      document.body.scrollWidth - window.innerWidth,
    );

    // Name the widest offender, so the report points at a culprit not a number.
    let widest = "";
    if (overflowX > 0) {
      let best = 0;
      for (const el of Array.from(document.querySelectorAll("body *"))) {
        const r = el.getBoundingClientRect();
        if (r.right > window.innerWidth + 1 && r.width > best) {
          best = r.width;
          const cls = (el.className?.toString?.() ?? "")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 4)
            .join(".");
          widest =
            el.tagName.toLowerCase() +
            (cls ? "." + cls : "") +
            " right=" +
            Math.round(r.right);
        }
      }
    }

    const tapTargets = [];
    for (const el of Array.from(
      document.querySelectorAll("a, button, summary, [role='button']"),
    )) {
      if (!isVisible(el)) continue;
      if (isInlineInProse(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.height < 40) {
        tapTargets.push(
          el.tagName.toLowerCase() +
            " h=" +
            Math.round(r.height) +
            ' "' +
            nameOf(el).slice(0, 40) +
            '"',
        );
      }
    }

    const inputs = [];
    const unlabelled = [];
    for (const el of Array.from(
      document.querySelectorAll("input, textarea, select"),
    )) {
      const type = (el.type || "").toLowerCase();
      if (["hidden", "radio", "checkbox", "file", "submit"].includes(type)) {
        continue;
      }
      if (!isVisible(el)) continue;
      // Measure the control a finger actually lands on. A bare input inside a
      // 40px bordered shell measures 38px, but the wrapping <label> focuses it
      // from edge to edge, so the input's own box is not the tap target.
      const shell = el.closest("label") ?? el;
      const r = shell.getBoundingClientRect();
      if (r.height < 40) {
        inputs.push(
          el.tagName.toLowerCase() + "[" + type + "] h=" + Math.round(r.height),
        );
      }
      const labelled =
        el.getAttribute("aria-label") ||
        el.getAttribute("aria-labelledby") ||
        (el.id &&
          document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) ||
        el.closest("label") ||
        el.getAttribute("placeholder");
      if (!labelled) {
        unlabelled.push(
          el.tagName.toLowerCase() + "[" + type + "]#" + (el.id || "?"),
        );
      }
    }

    const namelessControls = [];
    for (const el of Array.from(
      document.querySelectorAll("button, a[href], [role='button']"),
    )) {
      if (!isVisible(el)) continue;
      if (nameOf(el)) continue;
      if (el.querySelector("img[alt]:not([alt=''])")) continue;
      const cls = (el.className?.toString?.() ?? "").split(/\s+/)[0] ?? "";
      namelessControls.push(el.tagName.toLowerCase() + "." + cls);
    }

    const imagesNoAlt = [];
    const brokenImages = [];
    for (const img of Array.from(document.querySelectorAll("img"))) {
      if (img.getAttribute("alt") === null) {
        imagesNoAlt.push(img.currentSrc || img.src || "(no src)");
      }
      if (img.complete && img.naturalWidth === 0 && isVisible(img)) {
        brokenImages.push(img.currentSrc || img.src || "(no src)");
      }
    }

    const seen = new Set();
    const dupeIds = [];
    for (const el of Array.from(document.querySelectorAll("[id]"))) {
      if (!el.id) continue;
      if (seen.has(el.id)) dupeIds.push(el.id);
      else seen.add(el.id);
    }

    const headingSkips = [];
    let prev = 0;
    for (const el of Array.from(
      document.querySelectorAll("h1,h2,h3,h4,h5,h6"),
    )) {
      if (!isVisible(el)) continue;
      const level = Number(el.tagName[1]);
      if (prev && level > prev + 1) {
        headingSkips.push(
          "h" + prev + " -> h" + level + ' "' + nameOf(el).slice(0, 40) + '"',
        );
      }
      prev = level;
    }
    const h1Count = Array.from(document.querySelectorAll("h1")).filter(
      isVisible,
    ).length;

    // A transparent body borrows the host background and breaks theming.
    const bodyBg = getComputedStyle(document.body).backgroundColor;

    return {
      overflowX,
      widest,
      tapTargets: tapTargets.slice(0, 10),
      inputs: inputs.slice(0, 10),
      unlabelled: unlabelled.slice(0, 10),
      namelessControls: [...new Set(namelessControls)].slice(0, 10),
      imagesNoAlt: imagesNoAlt.slice(0, 10),
      brokenImages: brokenImages.slice(0, 10),
      dupeIds: [...new Set(dupeIds)].slice(0, 10),
      headingSkips: headingSkips.slice(0, 6),
      h1Count,
      bodyBg,
      title: document.title,
    };
  });
}

async function auditRoute(browser, route, vp, theme) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    colorScheme: theme,
    storageState: process.env.AUDIT_STORAGE || undefined,
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const badRequests = [];

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (IGNORED_CONSOLE.test(text)) return;
    consoleErrors.push(text.slice(0, 300));
  });
  page.on("pageerror", (err) => pageErrors.push(String(err).slice(0, 300)));
  page.on("requestfailed", (req) => {
    const f = req.failure()?.errorText ?? "failed";
    if (/ERR_ABORTED/.test(f)) return;
    badRequests.push(req.method() + " " + req.url().slice(0, 120) + " " + f);
  });
  page.on("response", (res) => {
    if (res.status() < 500) return;
    badRequests.push("HTTP " + res.status() + " " + res.url().slice(0, 120));
  });

  const base = {
    route: route.path,
    group: route.group,
    viewport: vp.id,
    theme,
  };

  try {
    const res = await page.goto(BASE + route.path, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await setTheme(page, theme);
    await page
      .waitForLoadState("networkidle", { timeout: 20000 })
      .catch(() => {});
    await page.waitForTimeout(500);

    const status = res?.status() ?? 0;
    const landed = new URL(page.url()).pathname;

    if (landed !== route.path && landed === "/login") {
      add({
        ...base,
        check: "auth-gate",
        severity: "INFO",
        detail: "redirected to /login (needs a session)",
      });
      await context.close();
      return;
    }
    if (status >= 400) {
      add({
        ...base,
        check: "http",
        severity: "ERROR",
        detail: "HTTP " + status,
      });
      await context.close();
      return;
    }

    const d = await domChecks(page);

    add({
      ...base,
      check: "overflow-x",
      severity: d.overflowX > 0 ? "ERROR" : "INFO",
      detail: d.overflowX > 0 ? d.overflowX + "px | " + d.widest : "none",
    });
    add({
      ...base,
      check: "theme-paint",
      severity:
        d.bodyBg === "rgba(0, 0, 0, 0)" || d.bodyBg === "transparent"
          ? "ERROR"
          : "INFO",
      detail: "body bg " + d.bodyBg,
    });
    add({
      ...base,
      check: "title",
      severity: d.title.trim() ? "INFO" : "ERROR",
      detail: d.title || "(empty)",
    });
    add({
      ...base,
      check: "h1",
      severity: d.h1Count === 1 ? "INFO" : "WARN",
      detail: d.h1Count + " visible h1",
    });

    const table = [
      ["tap-targets", d.tapTargets, "WARN"],
      ["input-height", d.inputs, "WARN"],
      ["unlabelled-input", d.unlabelled, "ERROR"],
      ["nameless-control", d.namelessControls, "ERROR"],
      ["img-no-alt", d.imagesNoAlt, "WARN"],
      ["img-broken", d.brokenImages, "ERROR"],
      ["duplicate-id", d.dupeIds, "ERROR"],
      ["heading-skip", d.headingSkips, "WARN"],
      ["console-error", consoleErrors, "ERROR"],
      ["page-error", pageErrors, "ERROR"],
      ["request-failed", badRequests, "ERROR"],
    ];
    for (const [check, list, severity] of table) {
      add({
        ...base,
        check,
        severity: list.length ? severity : "INFO",
        detail: list.length ? list.join(" | ") : "clean",
      });
    }

    if (WANT_SHOTS) {
      const key =
        (route.path.replace(/\W+/g, "_") || "root") + "-" + vp.id + "-" + theme;
      await page.screenshot({ path: join(OUT, key + ".png"), fullPage: true });
    }
  } catch (err) {
    add({
      ...base,
      check: "exception",
      severity: "ERROR",
      detail: String(err).slice(0, 300),
    });
  } finally {
    await context.close();
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const want = process.env.AUDIT_ROUTES ?? "all";
  const routes = ROUTES.filter((r) => {
    if (want === "public") return ["public", "auth", "qa"].includes(r.group);
    if (want === "gated") return ["capper", "admin"].includes(r.group);
    return true;
  });

  const browser = await chromium.launch({ headless: true });
  let n = 0;
  const total = routes.length * VIEWPORTS.length * THEMES.length;
  for (const route of routes) {
    for (const vp of VIEWPORTS) {
      for (const theme of THEMES) {
        await auditRoute(browser, route, vp, theme);
        n++;
        if (n % 25 === 0) console.log("  ..." + n + "/" + total);
      }
    }
  }
  await browser.close();

  const defects = findings.filter((f) => f.severity !== "INFO");
  writeFileSync(
    join(OUT, "findings.json"),
    JSON.stringify({ total, findings }, null, 2),
  );

  // Collapse the matrix: one line per (route, check), listing where it fired.
  const grouped = new Map();
  for (const f of defects) {
    const k = f.severity + "\t" + f.check + "\t" + f.route;
    const arr = grouped.get(k);
    if (arr) arr.push(f);
    else grouped.set(k, [f]);
  }
  const lines = [...grouped.entries()].sort().map(([k, fs]) => {
    const where = fs.map((f) => f.viewport + "/" + f.theme).join(",");
    return k + "\t[" + where + "]\t" + fs[0].detail;
  });
  writeFileSync(join(OUT, "report.tsv"), lines.join("\n"));

  console.log(
    "\nchecks run: " + findings.length + " across " + total + " loads",
  );
  console.log("defects:    " + defects.length);
  console.log(
    "ERROR:      " + defects.filter((f) => f.severity === "ERROR").length,
  );
  console.log(
    "WARN:       " + defects.filter((f) => f.severity === "WARN").length,
  );
  console.log("\nreport: " + join(OUT, "report.tsv") + "\n");
  for (const line of lines) console.log(line);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
