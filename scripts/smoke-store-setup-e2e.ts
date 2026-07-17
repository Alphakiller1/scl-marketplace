/**
 * Read-only store-setup smoke against production.
 * Requires SCL_SMOKE_EMAIL + SCL_SMOKE_PASSWORD (account must be ADMIN).
 *
 * Does not create packages — the admin store-smoke API was removed.
 * After deploy, ensure-owner-admin deactivates leftover "SCL Smoke E2E Package".
 */
const EMAIL = process.env.SCL_SMOKE_EMAIL || "chase4sichi@gmail.com";
const PASSWORD = process.env.SCL_SMOKE_PASSWORD;
const BASE = process.env.SCL_SMOKE_BASE || "https://scl-marketplace.vercel.app";
const SMOKE_TITLE = "SCL Smoke E2E Package";

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

  // Multi-package editor mounts whenever a connection is selected.
  if (storeHtml.includes("Request detail")) {
    for (const needle of [
      "New package",
      "Package name",
      "Affiliate purchase link",
      "Tracked clicks",
      "Display order",
    ]) {
      if (!storeHtml.includes(needle)) fail(`store-setup missing: ${needle}`);
    }
  }

  const smokeApi = await fetch(`${BASE}/api/admin/store-smoke`, {
    method: "POST",
    headers: { cookie },
  });
  if (smokeApi.status !== 404) {
    fail(`store-smoke API should be 404, got ${smokeApi.status}`);
  }

  const monetization = await fetch(`${BASE}/dashboard/monetization`, {
    headers: { cookie },
  });
  if (monetization.status !== 200) fail("monetization not 200");

  const packagesPage = await fetch(`${BASE}/packages`);
  if (packagesPage.status !== 200) fail("packages not 200");
  const packagesHtml = await packagesPage.text();
  if (packagesHtml.includes(SMOKE_TITLE)) {
    fail("smoke package still live on /packages — redeploy ensure-owner-admin");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        role: session.user.role,
        storeSetup: storeSetup.status,
        hasConnectionDetail: storeHtml.includes("Request detail"),
        monetization: monetization.status,
        packages: packagesPage.status,
        storeSmokeApi: smokeApi.status,
        smokePackageLive: false,
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
