import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isBlockedAddress } from "@/lib/remote-image-fetch";

/**
 * These ranges are the whole defence for a server-side fetch of a user-supplied
 * URL. A gap here is an SSRF, so each family is pinned rather than trusted to
 * the regex reading correctly.
 */
describe("isBlockedAddress", () => {
  it("blocks loopback", () => {
    for (const a of ["127.0.0.1", "127.1.2.3", "::1", "::ffff:127.0.0.1"]) {
      assert.equal(isBlockedAddress(a), true, a);
    }
  });

  it("blocks the private IPv4 ranges", () => {
    for (const a of [
      "10.0.0.1",
      "10.255.255.254",
      "172.16.0.1",
      "172.31.255.254",
      "192.168.1.1",
    ]) {
      assert.equal(isBlockedAddress(a), true, a);
    }
  });

  // The one that matters most: cloud metadata lives on link-local.
  it("blocks link-local, including the metadata address", () => {
    assert.equal(isBlockedAddress("169.254.169.254"), true);
    assert.equal(isBlockedAddress("fe80::1"), true);
  });

  it("blocks CGNAT, this-network, and multicast", () => {
    for (const a of ["100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255"]) {
      assert.equal(isBlockedAddress(a), true, a);
    }
  });

  it("blocks IPv6 unique-local", () => {
    assert.equal(isBlockedAddress("fc00::1"), true);
    assert.equal(isBlockedAddress("fd12:3456::1"), true);
  });

  // 172.15 and 172.32 sit either side of the private block and must pass, or
  // ordinary hosts get refused.
  it("allows ordinary public addresses", () => {
    for (const a of [
      "8.8.8.8",
      "1.1.1.1",
      "172.15.0.1",
      "172.32.0.1",
      "192.167.1.1",
      "2606:4700::1111",
    ]) {
      assert.equal(isBlockedAddress(a), false, a);
    }
  });

  it("blocks empty input and out-of-range octets", () => {
    for (const a of ["", "   ", "999.1.1.1", "1.2.3.999"]) {
      assert.equal(isBlockedAddress(a), true, JSON.stringify(a));
    }
  });

  // This answers "is this literal IP private?", so anything that is not an IP
  // literal is not its business — `hostIsPublic` resolves those through DNS and
  // re-checks every address that comes back.
  it("leaves non-literals to the DNS check", () => {
    for (const a of ["example.com", "1.2.3"]) {
      assert.equal(isBlockedAddress(a), false, a);
    }
  });
});
