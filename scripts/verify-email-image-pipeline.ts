/**
 * Prove an image dropped into an admin email survives the whole trip.
 *
 * Uploads a generated picture through the real code path, fetches it back from
 * the public URL the way a recipient's mail client will, and renders the mail
 * that would be sent. Every step is the production one — no mocks — because the
 * failures worth catching here (a bucket that is not public, credentials naming
 * two projects, a URL that 404s) are invisible to a unit test and permanent once
 * a mass email has gone out.
 *
 *   npx tsx scripts/verify-email-image-pipeline.ts
 */
import { randomBytes } from "node:crypto";
import process from "node:process";

import sharp from "sharp";

import { renderBroadcastHtml } from "../src/lib/email";
import {
  buildEmailImageId,
  collectEmailImageIds,
  emailImageObjectPath,
  formatEmailImageToken,
} from "../src/lib/email-image";
import { optimizeEmailImage } from "../src/lib/email-image-process";
import {
  emailImageUrlResolver,
  verifyEmailImagesDeliverable,
} from "../src/lib/email-image-url";
import {
  ensureStorageBucket,
  getEmailMediaStorage,
  storageObjectIsPublic,
  storagePublicUrl,
  uploadStorageObject,
} from "../src/lib/supabase-storage";

try {
  process.loadEnvFile();
} catch {
  // No .env — fall back to ambient environment variables.
}

let failures = 0;

function check(label: string, ok: boolean, detail = "") {
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`,
  );
  if (!ok) failures += 1;
}

async function main() {
  const storage = getEmailMediaStorage();
  if (!storage) {
    console.error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set — nothing to verify.",
    );
    process.exitCode = 1;
    return;
  }
  console.log(`bucket: ${storage.bucket} @ ${storage.projectUrl}\n`);

  const ready = await ensureStorageBucket(storage);
  check("bucket exists and is writable", ready.ok, ready.ok ? "" : ready.error);
  if (!ready.ok) {
    process.exitCode = 1;
    return;
  }

  // A wide graphic with transparency, the shape a slate export usually arrives in.
  const source = await sharp({
    create: {
      width: 1800,
      height: 700,
      channels: 4,
      background: { r: 12, g: 24, b: 48, alpha: 0.55 },
    },
  })
    .png()
    .toBuffer();

  const processed = await optimizeEmailImage(source);
  const meta = await sharp(processed.data).metadata();
  check(
    "resized to the 2x email width and flattened to JPEG",
    meta.format === "jpeg" && meta.width === 1120 && meta.hasAlpha !== true,
    `${meta.format} ${meta.width}x${meta.height} alpha=${meta.hasAlpha}`,
  );
  check(
    "reported width matches the encoded bytes",
    processed.width === meta.width,
    `${processed.width} vs ${meta.width}`,
  );

  // Minted exactly the way the upload action does it.
  const id = buildEmailImageId(randomBytes(8).toString("hex"), processed.width);
  const path = emailImageObjectPath(id);
  if (!path) {
    check("minted id resolves to a storage path", false, id);
    process.exitCode = 1;
    return;
  }

  const uploaded = await uploadStorageObject(
    storage,
    path,
    processed.data,
    "image/jpeg",
  );
  check("upload accepted", uploaded.ok, uploaded.ok ? path : uploaded.error);
  if (!uploaded.ok) {
    process.exitCode = 1;
    return;
  }

  const url = storagePublicUrl(storage, path);
  check(
    "public URL is fetchable without auth",
    await storageObjectIsPublic(storage, path),
    url,
  );

  // The bytes an inbox receives must be the bytes that were stored.
  const fetched = await fetch(url, { cache: "no-store" });
  const bytes = Buffer.from(await fetched.arrayBuffer());
  check(
    "served as an image of the right size",
    fetched.headers.get("content-type")?.includes("image/jpeg") === true &&
      bytes.length === processed.data.length,
    `${fetched.headers.get("content-type")} ${bytes.length}B vs ${processed.data.length}B`,
  );

  const body = `Week 1 is live.\n\n${formatEmailImageToken(id, "Week 1 slate")}\n\nGood luck.`;
  check(
    "the message references exactly one image",
    collectEmailImageIds(body).length === 1,
  );

  const gate = await verifyEmailImagesDeliverable(body);
  check(
    "send gate passes for a real image",
    gate.ok,
    gate.ok ? "" : gate.error,
  );

  const fakeToken = formatEmailImageToken(
    buildEmailImageId("0123456789abcdef", 800),
    "missing",
  );
  const blocked = await verifyEmailImagesDeliverable(fakeToken);
  check(
    "send gate refuses an image that would 404",
    !blocked.ok,
    blocked.ok ? "it let a missing image through" : blocked.error,
  );

  const html = renderBroadcastHtml({
    body,
    imageUrl: emailImageUrlResolver(),
    unsubscribeUrl: "https://sportscappersleaderboard.com/unsubscribe?token=x",
  });
  check("rendered mail carries the image", html.includes(`src="${url}"`));
  check("rendered at the email content width", html.includes('width="560"'));
  check("alt text survives to the inbox", html.includes('alt="Week 1 slate"'));
  check(
    "paragraphs stay either side of it",
    html.indexOf("Week 1 is live.") < html.indexOf("<img") &&
      html.indexOf("<img") < html.indexOf("Good luck."),
  );

  console.log(
    `\n${failures === 0 ? "OK — the whole path works." : `${failures} check(s) failed.`}`,
  );
  console.log(`probe object left in place: ${path}`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
