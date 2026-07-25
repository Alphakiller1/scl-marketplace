import assert from "node:assert/strict";
import test from "node:test";

import {
  adminLoginCodeSchema,
  passwordResetRequestSchema,
  passwordSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/schemas/auth.schema";

test("password contract requires at least 12 characters", () => {
  assert.equal(passwordSchema.safeParse("short-pass").success, false);
  assert.equal(passwordSchema.safeParse("long-passphrase").success, true);
});

test("password reset request normalizes surrounding whitespace", () => {
  const parsed = passwordResetRequestSchema.parse({
    email: "  capper@example.com ",
  });

  assert.equal(parsed.email, "capper@example.com");
});

test("signup normalizes public handles and email addresses", () => {
  const parsed = signupSchema.parse({
    username: " Chase_Analytics ",
    email: " CAPPPER@EXAMPLE.COM ",
    password: "long-passphrase",
    confirmPassword: "long-passphrase",
    acceptTerms: true,
  });

  assert.equal(parsed.username, "chase_analytics");
  assert.equal(parsed.email, "cappper@example.com");
});

test("admin sign-in code must be exactly six digits", () => {
  const base = { email: "admin@scl.local", challengeId: "chal_1" };

  assert.equal(adminLoginCodeSchema.safeParse(base).success, false);
  assert.equal(
    adminLoginCodeSchema.safeParse({ ...base, code: "12345" }).success,
    false,
  );
  assert.equal(
    adminLoginCodeSchema.safeParse({ ...base, code: "12345a" }).success,
    false,
  );
  assert.equal(
    adminLoginCodeSchema.safeParse({ ...base, code: " 123456 " }).success,
    true,
  );
});

test("admin sign-in code rejects a password-only payload", () => {
  // The credentials provider relies on this failing so that an admin can never
  // complete the challenge branch without a challenge id and code.
  const parsed = adminLoginCodeSchema.safeParse({
    email: "admin@scl.local",
    password: "long-passphrase",
  });

  assert.equal(parsed.success, false);
});

test("password reset requires a valid token and matching passwords", () => {
  const token = "a".repeat(64);

  assert.equal(
    resetPasswordSchema.safeParse({
      token,
      password: "long-passphrase",
      confirmPassword: "different-passphrase",
    }).success,
    false,
  );
  assert.equal(
    resetPasswordSchema.safeParse({
      token,
      password: "long-passphrase",
      confirmPassword: "long-passphrase",
    }).success,
    true,
  );
});
