import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateReleaseConfiguration,
  releaseReadinessSummary,
} from "./release-readiness";

const READY_ENV = {
  DATABASE_URL:
    "postgresql://runtime@example.com:6543/db?pgbouncer=true&schema=scl",
  DIRECT_URL: "postgresql://direct@example.com:5432/db?schema=scl",
  AUTH_SECRET: "a".repeat(32),
  AUTH_TRUST_HOST: "true",
  AUTH_URL: "https://scl-marketplace.vercel.app",
  RESEND_API_KEY: "re_test",
  EMAIL_FROM: "no-reply@scl.example",
  SUPPORT_EMAIL_TO: "support@scl.example",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  ODDS_API_KEY: "odds-key",
  CRON_SECRET: "cron-secret",
  WHOP_WEBHOOK_SECRET: "whop-secret",
  SCL_ALLOW_GHOST_PUBLICATION: "0",
  VERCEL_ENV: "production",
  VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
};

test("release configuration is ready when launch-critical services exist", () => {
  const checks = evaluateReleaseConfiguration(READY_ENV);
  assert.deepEqual(releaseReadinessSummary(checks), {
    ready: 10,
    warning: 0,
    blocked: 0,
  });
});

test("release configuration blocks unsafe launch defaults", () => {
  const checks = evaluateReleaseConfiguration({
    ...READY_ENV,
    DIRECT_URL: undefined,
    AUTH_SECRET: "short",
    EMAIL_FROM: "no-reply@scl.local",
    SUPPORT_EMAIL_TO: undefined,
    ODDS_API_KEY: undefined,
    CRON_SECRET: undefined,
    SCL_ALLOW_GHOST_PUBLICATION: "1",
    VERCEL_GIT_COMMIT_SHA: undefined,
  });

  const blocked = checks
    .filter((check) => check.status === "blocked")
    .map((check) => check.id);
  assert.deepEqual(blocked, [
    "database-config",
    "authentication-config",
    "transactional-email",
    "support-mailbox",
    "odds-provider",
    "grading-cron",
    "ghost-publication",
    "release-identity",
  ]);
});

test("optional integrations are warnings instead of false launch claims", () => {
  const checks = evaluateReleaseConfiguration({
    ...READY_ENV,
    SUPABASE_URL: undefined,
    WHOP_WEBHOOK_SECRET: undefined,
  });
  const warnings = checks
    .filter((check) => check.status === "warning")
    .map((check) => check.id);
  assert.deepEqual(warnings, ["profile-media", "whop-webhook"]);
});

test("profile media accepts Supabase Vercel integration key names", () => {
  const checks = evaluateReleaseConfiguration({
    ...READY_ENV,
    SUPABASE_URL: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SECRET_KEY: "secret-from-vercel",
  });
  const profileMedia = checks.find((check) => check.id === "profile-media");
  assert.equal(profileMedia?.status, "ready");
});
