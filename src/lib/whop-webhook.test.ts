import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

import { verifyWhopSignature } from "@/lib/whop-webhook";

const SECRET = "ws_test_secret";
const BODY = JSON.stringify({
  action: "membership.went_valid",
  data: { id: "mem_1" },
});

function sign(body: string, ts: string, secret = SECRET) {
  return createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
}

function headers(over: Record<string, string> = {}) {
  const ts = String(Math.floor(Date.now() / 1000));
  return new Headers({
    "x-whop-timestamp": ts,
    "x-whop-signature": sign(BODY, ts),
    ...over,
  });
}

test("accepts a correctly signed delivery", () => {
  assert.equal(verifyWhopSignature(BODY, headers(), SECRET).ok, true);
});

test("accepts the v1=<hex> signature list form", () => {
  const ts = String(Math.floor(Date.now() / 1000));
  const h = new Headers({
    "x-whop-timestamp": ts,
    "x-whop-signature": `v1=${sign(BODY, ts)},v0=deadbeef`,
  });
  assert.equal(verifyWhopSignature(BODY, h, SECRET).ok, true);
});

test("rejects a tampered body", () => {
  const res = verifyWhopSignature(BODY + " ", headers(), SECRET);
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.status, 401);
});

test("rejects a signature made with the wrong secret", () => {
  const ts = String(Math.floor(Date.now() / 1000));
  const h = new Headers({
    "x-whop-timestamp": ts,
    "x-whop-signature": sign(BODY, ts, "ws_wrong"),
  });
  assert.equal(verifyWhopSignature(BODY, h, SECRET).ok, false);
});

test("fails closed when the secret is unset — never accepts everything", () => {
  const res = verifyWhopSignature(BODY, headers(), undefined);
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.status, 503);
});

test("rejects a replayed delivery outside the timestamp window", () => {
  const old = String(Math.floor(Date.now() / 1000) - 60 * 60);
  const h = new Headers({
    "x-whop-timestamp": old,
    "x-whop-signature": sign(BODY, old),
  });
  const res = verifyWhopSignature(BODY, h, SECRET);
  assert.equal(res.ok, false);
  if (!res.ok) assert.match(res.reason, /timestamp/);
});

test("rejects missing signature or timestamp headers", () => {
  const ts = String(Math.floor(Date.now() / 1000));
  assert.equal(
    verifyWhopSignature(BODY, new Headers({ "x-whop-timestamp": ts }), SECRET)
      .ok,
    false,
  );
  assert.equal(
    verifyWhopSignature(
      BODY,
      new Headers({ "x-whop-signature": "abc" }),
      SECRET,
    ).ok,
    false,
  );
});

test("accepts millisecond timestamps as well as seconds", () => {
  const ms = String(Date.now());
  const h = new Headers({
    "x-whop-timestamp": ms,
    "x-whop-signature": sign(BODY, ms),
  });
  assert.equal(verifyWhopSignature(BODY, h, SECRET).ok, true);
});
