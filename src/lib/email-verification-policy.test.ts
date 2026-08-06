import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  emailVerificationEnforced,
  mailerConfigured,
} from "@/lib/email-verification-policy";

const ENV_KEYS = [
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "REQUIRE_EMAIL_VERIFICATION",
] as const;
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const key of ENV_KEYS) {
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("mailerConfigured", () => {
  it("needs both a key and a real sender", () => {
    setEnv({
      RESEND_API_KEY: "re_live",
      EMAIL_FROM: "no-reply@sportscappersleaderboard.com",
    });
    assert.equal(mailerConfigured(), true);
  });

  it("is false with a sender but no key", () => {
    setEnv({ EMAIL_FROM: "no-reply@sportscappersleaderboard.com" });
    assert.equal(mailerConfigured(), false);
  });

  it("is false with a key but no sender", () => {
    setEnv({ RESEND_API_KEY: "re_live" });
    assert.equal(mailerConfigured(), false);
  });

  it("treats the placeholder sender as unset", () => {
    setEnv({ RESEND_API_KEY: "re_live", EMAIL_FROM: "no-reply@scl.local" });
    assert.equal(mailerConfigured(), false);
  });
});

describe("emailVerificationEnforced", () => {
  it("is off unless explicitly enabled", () => {
    setEnv({
      RESEND_API_KEY: "re_live",
      EMAIL_FROM: "no-reply@sportscappersleaderboard.com",
    });
    assert.equal(emailVerificationEnforced(), false);
  });

  it("is on when the flag is exactly 'true'", () => {
    setEnv({ REQUIRE_EMAIL_VERIFICATION: "true" });
    assert.equal(emailVerificationEnforced(), true);
  });

  it("does not enable on a near-miss value", () => {
    setEnv({ REQUIRE_EMAIL_VERIFICATION: "TRUE" });
    assert.equal(emailVerificationEnforced(), false);
    setEnv({ REQUIRE_EMAIL_VERIFICATION: "1" });
    assert.equal(emailVerificationEnforced(), false);
  });

  // The bug this whole module exists to prevent: enforcement and recording were
  // one switch, so turning the gate off silently made signup claim verification
  // it had never obtained.
  it("is independent of whether mail can be sent", () => {
    setEnv({ REQUIRE_EMAIL_VERIFICATION: "true" });
    assert.equal(mailerConfigured(), false);
    assert.equal(emailVerificationEnforced(), true);
  });
});
