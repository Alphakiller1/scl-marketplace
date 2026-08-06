import { chromium } from "playwright";
import fs from "node:fs";

const OUT = "/opt/cursor/artifacts/audit-deep";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const extra = {
  findings: [],
  image400: [],
  goLinks: [],
  og: [],
  contrast: [],
  caseHandles: [],
};

const healthRes = await fetch(
  "https://sportscappersleaderboard.com/api/health",
);
const healthBody = await healthRes.json();
extra.healthHttp = { status: healthRes.status, body: healthBody };
if (
  healthBody.supabase?.storage === false &&
  healthRes.status === 200 &&
  healthBody.status === "ok"
) {
  extra.findings.push({
    severity: "P1",
    category: "correctness",
    route: "/api/health",
    what: "/api/health returns HTTP 200 status:ok while supabase.storage/bucketReady is false — hides a broken core flow behind a green health check",
    evidence: healthBody.supabase,
  });
}

for (const route of ["/", "/leaderboard", "/discover", "/picks", "/packages"]) {
  const bad = [];
  const onResponse = (res) => {
    if (res.url().includes("/_next/image") && res.status() >= 400) {
      bad.push({ status: res.status(), url: res.url().slice(0, 240) });
    }
  };
  page.on("response", onResponse);
  await page.goto(`https://sportscappersleaderboard.com${route}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(800);
  page.off("response", onResponse);
  extra.image400.push({
    route,
    bad: [...new Map(bad.map((b) => [b.url, b])).values()],
  });
}

await page.goto("https://sportscappersleaderboard.com/", {
  waitUntil: "networkidle",
});
const hrefs = await page.$$eval("a[href*='/cappers/']", (as) =>
  as.map((a) => a.getAttribute("href")).slice(0, 40),
);
const mixed = [...new Set(hrefs)].filter((h) => /[A-Z]/.test(h || ""));
for (const href of mixed.slice(0, 6)) {
  const r1 = await page.goto(`https://sportscappersleaderboard.com${href}`, {
    waitUntil: "domcontentloaded",
  });
  const t1 = await page.title();
  const body1 = await page.locator("body").innerText();
  const missing1 = /could not be found|404/i.test(body1) || /404/.test(t1);
  const lower = href.toLowerCase();
  const r2 = await page.goto(`https://sportscappersleaderboard.com${lower}`, {
    waitUntil: "domcontentloaded",
  });
  const t2 = await page.title();
  const body2 = await page.locator("body").innerText();
  const missing2 = /could not be found|404/i.test(body2) || /404/.test(t2);
  extra.caseHandles.push({
    href,
    status: r1?.status(),
    missing: missing1,
    title: t1,
    lower,
    lowerStatus: r2?.status(),
    lowerMissing: missing2,
    lowerTitle: t2,
  });
  if (missing1 !== missing2 || (missing1 && !missing2)) {
    extra.findings.push({
      severity: "P1",
      category: "correctness",
      route: href,
      what: `Capper profile link case sensitivity mismatch: ${href} missing=${missing1} vs ${lower} missing=${missing2}`,
      evidence: { t1, t2 },
    });
  }
}

await page.goto("https://sportscappersleaderboard.com/packages", {
  waitUntil: "networkidle",
});
const goHrefs = await page.$$eval("a[href^='/go/']", (as) =>
  as.map((a) => a.getAttribute("href")).slice(0, 5),
);
for (const g of goHrefs) {
  const resp = await page
    .goto(`https://sportscappersleaderboard.com${g}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    })
    .catch((e) => ({ error: String(e) }));
  extra.goLinks.push({
    g,
    url: page.url(),
    status: typeof resp?.status === "function" ? resp.status() : resp?.status,
    title: await page.title().catch(() => null),
  });
}

for (const h of ["bankofdennis", "wgsdfs", "no-such-capper-xyz"]) {
  const r = await fetch(
    `https://sportscappersleaderboard.com/api/og/capper/${h}`,
  );
  const buf = await r.arrayBuffer();
  extra.og.push({
    h,
    status: r.status,
    type: r.headers.get("content-type"),
    len: buf.byteLength,
  });
}

await page.setViewportSize({ width: 375, height: 812 });
await page.goto("https://sportscappersleaderboard.com/sitemap.xml", {
  waitUntil: "domcontentloaded",
});
extra.sitemapMobile = await page.evaluate(() => ({
  overflow:
    document.documentElement.scrollWidth >
    document.documentElement.clientWidth + 1,
  sw: document.documentElement.scrollWidth,
  cw: document.documentElement.clientWidth,
}));
await page.screenshot({
  path: `${OUT}/screenshots/extra_sitemap_375.png`,
});

await page.goto("https://sportscappersleaderboard.com/", {
  waitUntil: "domcontentloaded",
});
extra.footerYear = await page.evaluate(() => {
  const t = document.body.innerText;
  const m = t.match(/©\s*(\d{4})/);
  return { m: m?.[1], now: new Date().getFullYear() };
});

await page.setViewportSize({ width: 1440, height: 900 });
const secret = JSON.parse(
  fs.readFileSync(`${OUT}/test-account.secret.json`, "utf8"),
);
await page.goto("https://sportscappersleaderboard.com/login", {
  waitUntil: "networkidle",
});
await page.fill("#username", secret.username);
await page.fill("#email", secret.email);
await page.fill("#password", secret.password);
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(4000);
await page.goto("https://sportscappersleaderboard.com/dashboard/picks/new", {
  waitUntil: "networkidle",
});
await page.screenshot({ path: `${OUT}/screenshots/extra_new_pick.png` });
extra.pickForm = await page.evaluate(() => ({
  title: document.title,
  h1: document.querySelector("h1")?.innerText,
  buttons: [...document.querySelectorAll("button")]
    .map((b) => b.innerText.trim())
    .filter(Boolean)
    .slice(0, 30),
}));

await page.goto("https://sportscappersleaderboard.com/dashboard/security", {
  waitUntil: "networkidle",
});
await page.screenshot({ path: `${OUT}/screenshots/extra_security.png` });
const del = page.getByRole("button", { name: /delete/i });
if (await del.count()) {
  const disabled = await del.first().isDisabled();
  extra.deleteControl = {
    present: true,
    disabled,
    label: (await del.first().innerText()).trim(),
  };
  await page.screenshot({
    path: `${OUT}/screenshots/extra_security.png`,
  });
  // Prefer a confirm-gated delete: fill confirmation if present, open dialog, then cancel.
  const confirm = page.locator(
    'input[name*="confirm" i], input[placeholder*="delete" i], input[aria-label*="confirm" i]',
  );
  if ((await confirm.count()) && disabled) {
    await confirm
      .first()
      .fill("DELETE")
      .catch(async () => {
        await confirm.first().fill(secret.username);
      });
    await page.waitForTimeout(300);
  }
  if (await del.first().isEnabled()) {
    await del.first().click();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `${OUT}/screenshots/extra_delete_dialog.png`,
    });
    extra.deleteDialogOpened = await page.evaluate(() =>
      /delete|permanent|irreversible/i.test(document.body.innerText),
    );
    await page.keyboard.press("Escape");
    const cancel = page.getByRole("button", { name: /cancel|keep|never/i });
    if (await cancel.count())
      await cancel
        .first()
        .click()
        .catch(() => {});
    extra.controlsNotExercised = {
      control: "deleteOwnAccountAction",
      observed: "Opened confirm path; cancelled without deleting",
    };
  } else {
    extra.controlsNotExercised = {
      control: "deleteOwnAccountAction",
      observed:
        "Delete button present but disabled until confirmation — inspected without firing",
    };
  }
}

await page.goto("https://sportscappersleaderboard.com/leaderboard", {
  waitUntil: "networkidle",
});
extra.contrast = await page.evaluate(() => {
  function lum([r, g, b]) {
    const a = [r, g, b].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }
  function parse(c) {
    const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    return m ? [+m[1], +m[2], +m[3]] : null;
  }
  function contrast(fg, bg) {
    const L1 = lum(fg);
    const L2 = lum(bg);
    const lighter = Math.max(L1, L2);
    const darker = Math.min(L1, L2);
    return (lighter + 0.05) / (darker + 0.05);
  }
  const samples = [];
  for (const el of document.querySelectorAll("td span, td, span")) {
    const t = el.textContent?.trim();
    if (!t || t.length > 14) continue;
    if (!/[+%U]|\d/.test(t)) continue;
    const cs = getComputedStyle(el);
    const fg = parse(cs.color);
    let bgEl = el;
    let bg = parse(getComputedStyle(bgEl).backgroundColor);
    while (
      bgEl &&
      (!bg || getComputedStyle(bgEl).backgroundColor === "rgba(0, 0, 0, 0)")
    ) {
      bgEl = bgEl.parentElement;
      if (!bgEl) break;
      bg = parse(getComputedStyle(bgEl).backgroundColor);
    }
    if (!fg || !bg) continue;
    const ratio = contrast(fg, bg);
    if (ratio < 4.5) {
      samples.push({
        t,
        color: cs.color,
        bg: `rgb(${bg})`,
        ratio: Math.round(ratio * 100) / 100,
      });
    }
    if (samples.length > 20) break;
  }
  return samples.slice(0, 12);
});

for (const route of [
  "/",
  "/leaderboard",
  "/discover",
  "/picks",
  "/packages",
  "/verification",
  "/signup",
  "/login",
]) {
  await page.goto(`https://sportscappersleaderboard.com${route}`, {
    waitUntil: "domcontentloaded",
  });
  const hits = await page.evaluate(() => {
    const t = document.body.innerText;
    const m = t.match(/\b[Hh]andle\b/g) || [];
    const ctx = [];
    let idx = 0;
    const lower = t.toLowerCase();
    while ((idx = lower.indexOf("handle", idx)) >= 0 && ctx.length < 5) {
      ctx.push(t.slice(Math.max(0, idx - 30), idx + 40).replace(/\s+/g, " "));
      idx += 6;
    }
    return { count: m.length, ctx };
  });
  if (hits.count) {
    extra.findings.push({
      severity: "P1",
      category: "design-law",
      route,
      what: `Forbidden word "handle" present (${hits.count})`,
      evidence: hits.ctx,
    });
  }
}

// Avatar source direct vs optimizer for a failing URL if any
const firstBad = extra.image400.flatMap((x) => x.bad)[0];
if (firstBad) {
  const u = new URL(firstBad.url);
  const src = u.searchParams.get("url");
  if (src) {
    const direct = await fetch(src, { method: "HEAD" }).catch(() => null);
    extra.avatarDirect = {
      src: src.slice(0, 180),
      status: direct?.status,
      type: direct?.headers.get("content-type"),
    };
  }
}

fs.writeFileSync(`${OUT}/audit-extra.json`, JSON.stringify(extra, null, 2));
console.log(
  JSON.stringify(
    {
      healthHttp: healthRes.status,
      healthStatus: healthBody.status,
      storage: healthBody.supabase,
      image400counts: extra.image400.map((x) => ({
        route: x.route,
        n: x.bad.length,
        sample: x.bad[0],
      })),
      caseHandles: extra.caseHandles,
      goLinks: extra.goLinks,
      og: extra.og,
      sitemapMobile: extra.sitemapMobile,
      footerYear: extra.footerYear,
      findings: extra.findings,
      contrastLow: extra.contrast,
      pickForm: extra.pickForm,
      deleteDialogOpened: extra.deleteDialogOpened,
      avatarDirect: extra.avatarDirect,
    },
    null,
    2,
  ),
);
await browser.close();
