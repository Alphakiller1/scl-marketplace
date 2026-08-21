import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  isHeicBuffer,
  isHeicFileName,
  isHeicMimeType,
  isHeicUpload,
} from "@/lib/profile-media-format";

test("isHeicUpload accepts Mac Photos extensions and MIME types", () => {
  assert.equal(isHeicFileName("IMG_1234.HEIC"), true);
  assert.equal(isHeicMimeType("image/heif"), true);
  assert.equal(isHeicUpload("photo.heic", ""), true);
  assert.equal(isHeicUpload("avatar.jpg", "image/jpeg"), false);
});

test("isHeicBuffer detects ISO-BMFF HEIC containers", () => {
  const buffer = Buffer.alloc(16);
  buffer.write("....", 0);
  buffer.write("ftyp", 4);
  buffer.write("heic", 8);
  assert.equal(isHeicBuffer(buffer), true);
});

test("client conversion inspects the HEIC header when Safari omits the extension", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/lib/profile-media-client.ts"),
    "utf8",
  );
  assert.match(source, /fileLooksLikeHeic/);
  assert.match(source, /ftyp/);
});
