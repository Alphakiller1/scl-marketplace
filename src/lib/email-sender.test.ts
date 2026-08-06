import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseSenderAddress,
  parseSenderName,
  registrableHost,
  senderDomain,
  senderMatchesSite,
} from "@/lib/email-sender";

describe("parseSenderAddress", () => {
  it("reads a bare address", () => {
    assert.equal(
      parseSenderAddress("no-reply@sportscappersleaderboard.com"),
      "no-reply@sportscappersleaderboard.com",
    );
  });

  it("reads the address out of a display-name sender", () => {
    assert.equal(
      parseSenderAddress("SCL <No-Reply@SportsCappersLeaderboard.com>"),
      "no-reply@sportscappersleaderboard.com",
    );
  });

  it("rejects a value that is not an address", () => {
    assert.equal(parseSenderAddress("SCL"), null);
  });
});

describe("parseSenderName", () => {
  it("reads the display name", () => {
    assert.equal(
      parseSenderName("SCL <no-reply@sportscappersleaderboard.com>"),
      "SCL",
    );
  });

  it("strips the quotes RFC 5322 requires around a punctuated name", () => {
    assert.equal(
      parseSenderName('"Sports Cappers Leaderboard, Inc." <no-reply@scl.test>'),
      "Sports Cappers Leaderboard, Inc.",
    );
  });

  it("returns null for a bare address, which carries no name", () => {
    assert.equal(
      parseSenderName("no-reply@sportscappersleaderboard.com"),
      null,
    );
  });

  it("returns null when the angle form carries an empty name", () => {
    assert.equal(parseSenderName("  <no-reply@scl.test>"), null);
  });

  // The case a domain check cannot see: right address, wrong company.
  it("surfaces a foreign brand on an otherwise correct address", () => {
    const from = "Chase Analytics <no-reply@sportscappersleaderboard.com>";
    assert.equal(parseSenderName(from), "Chase Analytics");
    assert.equal(senderDomain(from), "sportscappersleaderboard.com");
  });
});

describe("senderDomain", () => {
  it("takes the domain after the last @", () => {
    assert.equal(senderDomain("SCL <a@b@example.com>"), "example.com");
  });
});

describe("registrableHost", () => {
  it("drops the scheme and a www prefix", () => {
    assert.equal(
      registrableHost("https://www.sportscappersleaderboard.com"),
      "sportscappersleaderboard.com",
    );
  });

  it("returns null for a non-URL", () => {
    assert.equal(registrableHost("not a url"), null);
  });
});

describe("senderMatchesSite", () => {
  const site = "sportscappersleaderboard.com";

  it("accepts the site domain itself", () => {
    assert.equal(senderMatchesSite(site, site), true);
  });

  it("accepts a sending subdomain", () => {
    assert.equal(senderMatchesSite(`mail.${site}`, site), true);
  });

  it("rejects an unrelated domain", () => {
    assert.equal(senderMatchesSite("chase-analytics.com", site), false);
  });

  it("rejects a lookalike suffix that is not a subdomain", () => {
    assert.equal(
      senderMatchesSite(`notsportscappersleaderboard.com`, site),
      false,
    );
  });

  it("is false when either side is unknown", () => {
    assert.equal(senderMatchesSite(null, site), false);
    assert.equal(senderMatchesSite(site, null), false);
  });
});
