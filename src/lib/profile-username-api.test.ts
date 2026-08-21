import assert from "node:assert/strict";
import test from "node:test";

import {
  isTrustedUsernameRequest,
  parseUsernameSavePayload,
  PROFILE_USERNAME_API_PATH,
} from "@/lib/profile-username-api";

test("username API path is a same-origin account route", () => {
  assert.equal(PROFILE_USERNAME_API_PATH, "/api/account/username");
});

test("parseUsernameSavePayload keeps server error copy", () => {
  assert.deepEqual(
    parseUsernameSavePayload({
      ok: true,
      usernameChanged: true,
      username: "mtndegen",
    }),
    { ok: true, usernameChanged: true, username: "mtndegen" },
  );
  assert.deepEqual(
    parseUsernameSavePayload({
      ok: false,
      error: "That handle is already taken.",
    }),
    { ok: false, error: "That handle is already taken." },
  );
  assert.equal(parseUsernameSavePayload("nope").ok, false);
});

test("username POSTs from the same origin are trusted", () => {
  assert.equal(
    isTrustedUsernameRequest({
      headers: {
        get: (name) => (name === "sec-fetch-site" ? "same-origin" : null),
      },
    }),
    true,
  );
  assert.equal(
    isTrustedUsernameRequest({
      headers: {
        get: (name) =>
          name === "origin" ? "https://www.sportscappersleaderboard.com" : null,
      },
    }),
    true,
  );
  assert.equal(
    isTrustedUsernameRequest({
      headers: {
        get: (name) => (name === "origin" ? "https://evil.example" : null),
      },
    }),
    false,
  );
});
