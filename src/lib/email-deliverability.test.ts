import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { probeMailer, resetMailerProbeCache } from "@/lib/email-deliverability";

const ENV_KEYS = ["RESEND_API_KEY", "EMAIL_FROM"] as const;
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
const realFetch = globalThis.fetch;

function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const key of ENV_KEYS) {
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function stubFetch(response: Response | (() => never)) {
  globalThis.fetch = (async () => {
    if (typeof response === "function") response();
    return response;
  }) as typeof fetch;
}

function domainsResponse(
  data: Array<{ name: string; status: string }>,
  status = 200,
) {
  return new Response(JSON.stringify({ data }), { status });
}

beforeEach(() => {
  resetMailerProbeCache();
  setEnv({
    RESEND_API_KEY: "re_live_key",
    EMAIL_FROM: "no-reply@sportscappersleaderboard.com",
  });
});

afterEach(() => {
  resetMailerProbeCache();
  globalThis.fetch = realFetch;
  for (const key of ENV_KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("probeMailer", () => {
  it("is deliverable when the sender domain is verified", async () => {
    stubFetch(
      domainsResponse([
        { name: "sportscappersleaderboard.com", status: "verified" },
      ]),
    );
    const probe = await probeMailer();
    assert.equal(probe.deliverable, true);
    assert.equal(probe.domainStatus, "verified");
    assert.equal(probe.reason, null);
  });

  it("accepts a subdomain sender covered by a verified domain", async () => {
    setEnv({
      RESEND_API_KEY: "re_live_key",
      EMAIL_FROM: "SCL <no-reply@mail.sportscappersleaderboard.com>",
    });
    stubFetch(
      domainsResponse([
        { name: "sportscappersleaderboard.com", status: "verified" },
      ]),
    );
    assert.equal((await probeMailer()).deliverable, true);
  });

  it("is not deliverable when the domain is registered but unverified", async () => {
    stubFetch(
      domainsResponse([
        { name: "sportscappersleaderboard.com", status: "pending" },
      ]),
    );
    const probe = await probeMailer();
    assert.equal(probe.deliverable, false);
    assert.equal(probe.domainStatus, "pending");
    assert.match(probe.reason ?? "", /not verified/);
  });

  it("is not deliverable when the sender domain is on another account", async () => {
    stubFetch(
      domainsResponse([{ name: "someone-else.com", status: "verified" }]),
    );
    const probe = await probeMailer();
    assert.equal(probe.deliverable, false);
    assert.match(probe.reason ?? "", /not registered/);
  });

  // A rotated-in-Resend-but-not-in-Vercel key is invisible otherwise: every send
  // fails, and every send failure is swallowed so signup keeps working.
  it("reports a rejected API key", async () => {
    stubFetch(domainsResponse([], 401));
    const probe = await probeMailer();
    assert.equal(probe.deliverable, false);
    assert.match(probe.reason ?? "", /rejected/);
  });

  it("reports missing configuration without calling the provider", async () => {
    setEnv({ EMAIL_FROM: "no-reply@sportscappersleaderboard.com" });
    stubFetch(() => {
      throw new Error("must not reach the network");
    });
    const probe = await probeMailer();
    assert.equal(probe.configured, false);
    assert.equal(probe.deliverable, false);
    assert.match(probe.reason ?? "", /RESEND_API_KEY/);
  });

  it("treats the placeholder sender as unconfigured", async () => {
    setEnv({ RESEND_API_KEY: "re_live_key", EMAIL_FROM: "no-reply@scl.local" });
    const probe = await probeMailer();
    assert.equal(probe.configured, false);
    assert.match(probe.reason ?? "", /placeholder/);
  });

  // Unknown must not read as broken — an unreachable provider is a network
  // problem, and reporting it as a mail outage sends you fixing the wrong thing.
  it("reports unknown, not broken, when the provider is unreachable", async () => {
    stubFetch(() => {
      throw new Error("network down");
    });
    const probe = await probeMailer();
    assert.equal(probe.deliverable, null);
    assert.equal(probe.configured, true);
  });

  it("caches so health polling does not hammer the provider", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return domainsResponse([
        { name: "sportscappersleaderboard.com", status: "verified" },
      ]);
    }) as typeof fetch;
    await probeMailer();
    await probeMailer();
    assert.equal(calls, 1);
  });
});
