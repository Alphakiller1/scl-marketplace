import assert from "node:assert/strict";
import test from "node:test";

import {
  PROFILE_MEDIA_LIMITS,
  exceedsProfileMediaSizeLimit,
  profileMediaSchema,
  resolveProfileMediaMimeType,
} from "@/lib/schemas/profile-media.schema";

test("resolveProfileMediaMimeType accepts declared MIME types", () => {
  const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
  assert.equal(resolveProfileMediaMimeType(file), "image/jpeg");
});

test("resolveProfileMediaMimeType infers type from extension when MIME is empty", () => {
  const file = new File(["x"], "avatar.png", { type: "" });
  assert.equal(resolveProfileMediaMimeType(file), "image/png");
});

test("resolveProfileMediaMimeType accepts HEIC from extension when MIME is empty", () => {
  const file = new File(["x"], "photo.heic", { type: "" });
  assert.equal(resolveProfileMediaMimeType(file), "image/heic");
});

test("resolveProfileMediaMimeType rejects unsupported extensions", () => {
  const file = new File(["x"], "photo.gif", { type: "" });
  assert.equal(resolveProfileMediaMimeType(file), null);
});

test("profileMediaSchema accepts HEIC files under the avatar limit", () => {
  const file = new File(["x"], "photo.heic", { type: "image/heic" });
  Object.defineProperty(file, "size", {
    value: PROFILE_MEDIA_LIMITS.avatar - 1,
  });

  const parsed = profileMediaSchema.safeParse({ kind: "avatar", file });
  assert.equal(parsed.success, true);
});

test("profileMediaSchema accepts files with empty MIME when extension is valid", () => {
  const file = new File(["x"], "avatar.webp", {
    type: "application/octet-stream",
  });
  Object.defineProperty(file, "size", {
    value: PROFILE_MEDIA_LIMITS.avatar - 1,
  });

  const parsed = profileMediaSchema.safeParse({ kind: "avatar", file });
  assert.equal(parsed.success, true);
});

test("avatar limit allows typical phone camera photos before Sharp compression", () => {
  assert.ok(
    PROFILE_MEDIA_LIMITS.avatar >= 5 * 1024 * 1024,
    "regression guard: avatars must accept up to 5 MB pre-processing",
  );

  const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
  Object.defineProperty(file, "size", { value: 4.5 * 1024 * 1024 });
  const parsed = profileMediaSchema.safeParse({ kind: "avatar", file });
  assert.equal(parsed.success, true, "4.5 MB JPEG must pass avatar validation");
});

test("resolveProfileMediaMimeType accepts image/jpg as JPEG", () => {
  const file = new File(["x"], "photo.jpg", { type: "image/jpg" });
  assert.equal(resolveProfileMediaMimeType(file), "image/jpeg");
});

test("5 MB is a maximum, not a minimum — tiny files must pass", () => {
  assert.equal(exceedsProfileMediaSizeLimit(0, "avatar"), false);
  assert.equal(exceedsProfileMediaSizeLimit(12, "avatar"), false);
  assert.equal(exceedsProfileMediaSizeLimit(50 * 1024, "avatar"), false);
  assert.equal(exceedsProfileMediaSizeLimit(1 * 1024 * 1024, "banner"), false);
  assert.equal(
    exceedsProfileMediaSizeLimit(PROFILE_MEDIA_LIMITS.avatar, "avatar"),
    false,
    "exactly 5 MB is allowed",
  );
  assert.equal(
    exceedsProfileMediaSizeLimit(PROFILE_MEDIA_LIMITS.avatar + 1, "avatar"),
    true,
  );

  const tiny = new File(["x"], "avatar.jpg", { type: "image/jpeg" });
  Object.defineProperty(tiny, "size", { value: 8 * 1024 });
  assert.equal(
    profileMediaSchema.safeParse({ kind: "avatar", file: tiny }).success,
    true,
    "8 KB JPEG must not be rejected as if 5 MB were a minimum",
  );
});

test("avatar limit still rejects files above the Server Action ceiling", () => {
  const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
  Object.defineProperty(file, "size", {
    value: PROFILE_MEDIA_LIMITS.avatar + 1,
  });
  const parsed = profileMediaSchema.safeParse({ kind: "avatar", file });
  assert.equal(parsed.success, false);
});
