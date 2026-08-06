import assert from "node:assert/strict";
import test from "node:test";

import {
  ensureSupabaseDatabaseEnvAliases,
  supabaseCredentialMismatch,
  supabaseIntegrationStatus,
  supabaseProjectUrl,
  supabaseRefFromKey,
  supabaseRefFromUrl,
  supabaseServiceRoleKey,
  supabaseStorageConfigured,
  usesSupabasePlatformSecretKey,
} from "@/lib/supabase-config";

/** A legacy service_role key is a JWT naming the project it belongs to. */
function serviceRoleKeyFor(ref: string): string {
  const part = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${part({ alg: "HS256", typ: "JWT" })}.${part({
    iss: "supabase",
    ref,
    role: "service_role",
  })}.signature`;
}

const ORIGINAL = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL);
}

test("supabaseProjectUrl accepts NEXT_PUBLIC_SUPABASE_URL", () => {
  restoreEnv();
  delete process.env.SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
  assert.equal(supabaseProjectUrl(), "https://abc.supabase.co");
});

test("supabaseServiceRoleKey accepts SUPABASE_SECRET_KEY from Vercel integration", () => {
  restoreEnv();
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_SECRET_KEY = "secret-from-vercel";
  assert.equal(supabaseServiceRoleKey(), "secret-from-vercel");
  assert.equal(supabaseStorageConfigured(), false);
  process.env.SUPABASE_URL = "https://abc.supabase.co";
  assert.equal(supabaseStorageConfigured(), true);
});

test("ensureSupabaseDatabaseEnvAliases maps POSTGRES vars with schema=scl", () => {
  restoreEnv();
  delete process.env.DATABASE_URL;
  delete process.env.DIRECT_URL;
  process.env.POSTGRES_PRISMA_URL =
    "postgresql://user:pass@host:6543/postgres?pgbouncer=true";
  process.env.POSTGRES_URL_NON_POOLING =
    "postgresql://user:pass@host:5432/postgres";

  ensureSupabaseDatabaseEnvAliases();

  assert.match(process.env.DATABASE_URL ?? "", /schema=scl/);
  assert.match(process.env.DIRECT_URL ?? "", /schema=scl/);
});

test("supabaseIntegrationStatus reports storage readiness", () => {
  restoreEnv();
  process.env.SUPABASE_URL = "https://abc.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  assert.deepEqual(supabaseIntegrationStatus(), {
    storage: true,
    url: true,
    serviceRole: true,
    bucket: "scl-profile-media",
  });
});

test("usesSupabasePlatformSecretKey detects new Supabase secret keys", () => {
  assert.equal(usesSupabasePlatformSecretKey("sb_secret_b2B0s_example"), true);
  assert.equal(
    usesSupabasePlatformSecretKey(
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.legacy-service-role",
    ),
    false,
  );
});

/**
 * A URL from one project paired with a key from another fails as `Invalid JWT`
 * or `Bucket not found` — indistinguishable from a genuinely missing bucket.
 * One such mismatch was chased as a storage problem while both projects had
 * the bucket the whole time.
 */

test("supabaseRefFromUrl reads the project ref out of the URL", () => {
  assert.equal(supabaseRefFromUrl("https://abcdef.supabase.co"), "abcdef");
  assert.equal(supabaseRefFromUrl("https://abcdef.supabase.co/"), "abcdef");
  assert.equal(supabaseRefFromUrl("not-a-url"), null);
});

test("supabaseRefFromKey reads the ref out of a legacy service_role JWT", () => {
  assert.equal(supabaseRefFromKey(serviceRoleKeyFor("abcdef")), "abcdef");
});

test("an opaque sb_secret_ key reports no ref rather than a wrong one", () => {
  // Cannot be decoded, so it must read as "unknown", never as "mismatched".
  assert.equal(supabaseRefFromKey("sb_secret_whatever"), null);
  assert.equal(supabaseRefFromKey("garbage"), null);
});

test("a cross-project URL/key pair is reported as a mismatch", () => {
  restoreEnv();
  process.env.SUPABASE_URL = "https://ljndtpzuslxgpnlxfhbz.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKeyFor(
    "mvxjcfriirguhjujurhf",
  );
  assert.deepEqual(supabaseCredentialMismatch(), {
    urlRef: "ljndtpzuslxgpnlxfhbz",
    keyRef: "mvxjcfriirguhjujurhf",
  });
});

test("a matching pair is not a mismatch", () => {
  restoreEnv();
  process.env.SUPABASE_URL = "https://ljndtpzuslxgpnlxfhbz.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKeyFor(
    "ljndtpzuslxgpnlxfhbz",
  );
  assert.equal(supabaseCredentialMismatch(), null);
});

test("an undecodable key is never reported as a mismatch", () => {
  restoreEnv();
  process.env.SUPABASE_URL = "https://ljndtpzuslxgpnlxfhbz.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_opaque";
  assert.equal(supabaseCredentialMismatch(), null);
});
