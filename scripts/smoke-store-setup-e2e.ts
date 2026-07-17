/**
 * HTTP-only store-setup e2e against production.
 * Requires SCL_SMOKE_EMAIL + SCL_SMOKE_PASSWORD (account must be ADMIN).
 */
const EMAIL = process.env.SCL_SMOKE_EMAIL || "chase4sichi@gmail.com";
const PASSWORD = process.env.SCL_SMOKE_PASSWORD;
const BASE = process.env.SCL_SMOKE_BASE || "https://scl-marketplace.vercel.app";
const TITLE = "SCL Smoke E2E Package";
const AFFILIATE_URL = "https://whop.com/checkout/plan_scl_smoke_e2e";

async function login(email: string, password: string) {
  const jar = new Map<string, string>();
  const store = (res: Response) => {
    const raw =
      typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : [];
    for (const c of raw) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
  };
  const cookie = () =>
    [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  store(csrfRes);
  const csrf = ((await csrfRes.json()) as { csrfToken: string }).csrfToken;
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookie(),
    },
    body: new URLSearchParams({
      csrfToken: csrf,
      email,
      password,
      callbackUrl: `${BASE}/dashboard`,
      json: "true",
    }),
  });
  store(loginRes);
  const session = (await (
    await fetch(`${BASE}/api/auth/session`, { headers: { cookie: cookie() } })
  ).json()) as { user?: { email?: string; role?: string } };
  return { cookie: cookie(), session, loginStatus: loginRes.status };
}

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

async function main() {
  if (!PASSWORD) fail("SCL_SMOKE_PASSWORD is required");

  const { cookie, session, loginStatus } = await login(EMAIL, PASSWORD!);
  if (loginStatus !== 302 || !session.user) fail("Login failed");
  if (session.user.role !== "ADMIN") {
    fail(
      `Role is ${session.user.role}, expected ADMIN. Redeploy ensure-owner-admin then re-login.`,
    );
  }

  const storeSetup = await fetch(`${BASE}/admin/store-setup`, {
    headers: { cookie },
    redirect: "manual",
  });
  if (storeSetup.status !== 200) {
    fail(`store-setup status ${storeSetup.status}`);
  }
  const storeHtml = await storeSetup.text();
  if (!storeHtml.includes("Store Setup Requests")) {
    fail("store-setup missing page header");
  }

  // Capper submit + admin import/publish in one authenticated admin helper.
  const smoke = await fetch(`${BASE}/api/admin/store-smoke`, {
    method: "POST",
    headers: { cookie },
  });
  const body = (await smoke.json()) as {
    ok?: boolean;
    error?: string;
    trackingPath?: string;
    trackingSlug?: string;
    profilePath?: string | null;
    title?: string;
  };
  if (!smoke.ok || !body.ok) {
    fail(`store-smoke API failed: ${smoke.status} ${body.error || ""}`);
  }

  const storeSetup2 = await fetch(`${BASE}/admin/store-setup?provider=WHOP`, {
    headers: { cookie },
  });
  const storeHtml2 = await storeSetup2.text();
  for (const needle of [
    "Package name",
    "Affiliate purchase link",
    "Display order",
    "Free trial",
    TITLE,
  ]) {
    if (!storeHtml2.includes(needle)) fail(`store-setup missing: ${needle}`);
  }

  const monetization = await fetch(`${BASE}/dashboard/monetization`, {
    headers: { cookie },
  });
  if (monetization.status !== 200) fail("monetization not 200");
  const monHtml = await monetization.text();
  if (!monHtml.includes("Whop") && !monHtml.includes("Live")) {
    console.warn("monetization page loaded but Whop/Live copy not found");
  }

  const packagesPage = await fetch(`${BASE}/packages`);
  const packagesHtml = await packagesPage.text();
  if (packagesPage.status !== 200) fail("packages not 200");
  if (!packagesHtml.includes(TITLE)) fail("packages missing smoke title");
  if (!packagesHtml.includes("Subscribe on Whop")) {
    fail("packages missing adaptive CTA");
  }
  if (!packagesHtml.includes("7-day free trial")) {
    fail("packages missing promo offer");
  }

  if (body.profilePath) {
    const profile = await fetch(`${BASE}${body.profilePath}`);
    if (profile.status !== 200) fail(`profile ${body.profilePath} not 200`);
  }

  const go = await fetch(`${BASE}${body.trackingPath}`, { redirect: "manual" });
  if (go.status !== 302) fail(`go status ${go.status}`);
  if (go.headers.get("location") !== AFFILIATE_URL) {
    fail(`go location mismatch: ${go.headers.get("location")}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        role: session.user.role,
        storeSetup: storeSetup.status,
        monetization: monetization.status,
        packages: packagesPage.status,
        go: go.status,
        trackingPath: body.trackingPath,
        title: body.title,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
