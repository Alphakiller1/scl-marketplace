import assert from "node:assert/strict";
import test from "node:test";

import {
  PROFILE_MEDIA_LIMITS,
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
