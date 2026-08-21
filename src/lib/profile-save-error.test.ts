import assert from "node:assert/strict";
import test from "node:test";

import { HANDLE_TAKEN_MESSAGE } from "@/lib/account-claim";
import {
  isUniqueHandleConflict,
  userFacingProfileSaveError,
} from "@/lib/profile-save-error";

test("unique conflicts surface as a taken handle, not a generic save error", () => {
  assert.equal(isUniqueHandleConflict({ code: "P2002" }), true);
  assert.equal(
    userFacingProfileSaveError({ code: "P2002" }, "profile"),
    HANDLE_TAKEN_MESSAGE,
  );
  assert.doesNotMatch(
    userFacingProfileSaveError({ code: "P2002" }, "profile"),
    /couldn't save your profile/,
  );
});

test("transient database codes ask the user to retry", () => {
  assert.match(
    userFacingProfileSaveError({ code: "P2024" }, "username"),
    /timed out/i,
  );
});

test("unknown prisma codes keep the surface name so support can tell username from profile", () => {
  assert.equal(
    userFacingProfileSaveError({ code: "P2011" }, "username"),
    "We couldn't save your username (P2011). Try again.",
  );
  assert.equal(
    userFacingProfileSaveError(new Error("boom"), "profile"),
    "We couldn't save your profile. Try again.",
  );
});
