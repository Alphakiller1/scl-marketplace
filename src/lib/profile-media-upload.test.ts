import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("upload action upserts CapperProfile and respects the verification gate policy", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/lib/actions/profile-media.action.ts"),
    "utf8",
  );

  assert.match(source, /capperProfile\.upsert\(/);
  assert.match(source, /emailVerificationEnforced\(\)/);
  assert.doesNotMatch(
    source,
    /accountStatus !== "ACTIVE" \|\| !account\.emailVerified/,
    "upload must not block all unverified accounts when the verify gate is off",
  );
  assert.match(source, /revalidateTag\("leaderboard"/);
  assert.match(source, /revalidatePath\("\/discover"\)/);
  assert.match(source, /revalidatePath\("\/cappers\/\[handle\]"/);
  assert.match(source, /afterResponse/);
});

test("profile media editor accepts HEIC in the file picker", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/scl/profile-media-editor.tsx"),
    "utf8",
  );

  assert.match(source, /image\/heic/);
  assert.match(source, /\.heic/);
  assert.match(source, /normalizeProfileMediaFile/);
  assert.match(source, /exceedsProfileMediaSizeLimit/);
  assert.match(source, /profileMediaSizeLimitMessage/);
  assert.doesNotMatch(
    source,
    /under 5 MB/,
    "5 MB is a max check, not the generic failure copy — small files were being told they were over the limit",
  );
});

test("HEIC uploads convert in the browser and fall back on the server", () => {
  const client = fs.readFileSync(
    path.join(process.cwd(), "src/lib/profile-media-client.ts"),
    "utf8",
  );
  const processSrc = fs.readFileSync(
    path.join(process.cwd(), "src/lib/profile-media-process.ts"),
    "utf8",
  );

  assert.match(client, /heic2any/);
  assert.match(client, /fileLooksLikeHeic/);
  assert.match(client, /rasterizeToJpeg/);
  assert.match(client, /return file/);
  assert.match(processSrc, /heic-convert/);
  assert.match(processSrc, /isHeicBuffer/);
  assert.match(processSrc, /"centre"/);
});
