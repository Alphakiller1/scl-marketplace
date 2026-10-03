import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { probeBrevo, resetBrevoProbeCache } from "@/lib/brevo-health";

const ENV_KEYS = [
  "BREVO_API_KEY",
  "BREVO_EMAIL_SEND",
  "BREVO_EMAIL_FROM",
  "BREVO_WEBHOOK_SECRET",
  "BREVO_DAILY_LIMIT",
  "EMAIL_FROM",
] as const;
const saved = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);
const realFetch = globalThis.fetch;

function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const key of ENV_KEYS) {
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

beforeEach(() => {
  resetBrevoProbeCache();
  setEnv({
    BREVO_API_KEY: "brevo-key",
    BREVO_EMAIL_FROM: "SCL <no-reply@sportscappersleaderboard.com>",
    BREVO_WEBHOOK_SECRET: "webhook-secret",
    BREVO_DAILY_LIMIT: "300",
  });
});

afterEach(() => {
  resetBrevoProbeCache();
  globalThis.fetch = realFetch;
  for (const key of ENV_KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("probeBrevo", () => {
  it("authenticates without sending and reports provider credits", async () => {
    let requested = "";
    globalThis.fetch = (async (input) => {
      requested = String(input);
      return new Response(
        JSON.stringify({
          plan: [{ credits: 300, creditsType: "sendLimit", type: "free" }],
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    const probe = await probeBrevo();
    assert.equal(requested, "https://api.brevo.com/v3/account");
    assert.equal(probe.configured, true);
    assert.equal(probe.authenticated, true);
    assert.equal(probe.providerCredits, 300);
    assert.equal(probe.reason, null);
  });

  it("accepts the transactional sender as the campaign fallback", async () => {
    setEnv({
      BREVO_API_KEY: "brevo-key",
      EMAIL_FROM: "no-reply@sportscappersleaderboard.com",
      BREVO_WEBHOOK_SECRET: "webhook-secret",
    });
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ plan: [] }), {
        status: 200,
      })) as typeof fetch;
    assert.equal((await probeBrevo()).authenticated, true);
  });

  it("reports missing webhook protection without touching Brevo", async () => {
    setEnv({
      BREVO_API_KEY: "brevo-key",
      BREVO_EMAIL_FROM: "no-reply@sportscappersleaderboard.com",
    });
    globalThis.fetch = (async () => {
      throw new Error("must not call the provider");
    }) as typeof fetch;
    const probe = await probeBrevo();
    assert.equal(probe.configured, false);
    assert.equal(probe.authenticated, false);
    assert.match(probe.reason ?? "", /WEBHOOK_SECRET/);
  });

  it("reports a rejected key", async () => {
    globalThis.fetch = (async () =>
      new Response(null, { status: 401 })) as typeof fetch;
    const probe = await probeBrevo();
    assert.equal(probe.authenticated, false);
    assert.match(probe.reason ?? "", /rejected/);
  });

  it("prefers the write-only rotation over the old key", async () => {
    setEnv({
      BREVO_API_KEY: "old-key",
      BREVO_EMAIL_SEND: "rotated-key",
      BREVO_EMAIL_FROM: "no-reply@sportscappersleaderboard.com",
      BREVO_WEBHOOK_SECRET: "webhook-secret",
    });
    const seen: string[] = [];
    globalThis.fetch = (async (_input, init) => {
      const key = String((init?.headers as Record<string, string>)["api-key"]);
      seen.push(key);
      return key === "rotated-key"
        ? new Response(JSON.stringify({ plan: [] }), { status: 200 })
        : new Response(null, { status: 401 });
    }) as typeof fetch;
    const probe = await probeBrevo();
    assert.equal(probe.authenticated, true);
    assert.deepEqual(seen, ["rotated-key"]);
  });

  it("treats provider reachability as unknown rather than a bad key", async () => {
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as typeof fetch;
    const probe = await probeBrevo();
    assert.equal(probe.configured, true);
    assert.equal(probe.authenticated, null);
  });

  it("caches repeated health checks", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response(JSON.stringify({ plan: [] }), { status: 200 });
    }) as typeof fetch;
    await probeBrevo();
    await probeBrevo();
    assert.equal(calls, 1);
  });
});
