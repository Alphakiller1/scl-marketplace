"use server";

import { randomBytes } from "crypto";

import {
  altTextFromFileName,
  buildEmailImageId,
  emailImageObjectPath,
} from "@/lib/email-image";
import { optimizeEmailImage } from "@/lib/email-image-process";
import { emailImageUploadSchema } from "@/lib/schemas/email-image.schema";
import { fetchRemoteImage } from "@/lib/remote-image-fetch";
import { requireAdmin } from "@/lib/session";
import {
  ensureStorageBucket,
  getEmailMediaStorage,
  storagePublicUrl,
  uploadStorageObject,
} from "@/lib/supabase-storage";

export type EmailImageUploadResult =
  | { ok: true; id: string; url: string; alt: string; width: number }
  | { ok: false; error: string };

/**
 * Host one image for an owner's email and hand back the handle to drop into the
 * message.
 *
 * Uploaded objects are never overwritten or reused: each upload mints a fresh
 * random handle. An email already sitting in an inbox fetches its picture every
 * time it is opened, so replacing an object in place would silently rewrite mail
 * that was sent weeks ago.
 */
export async function uploadEmailImageAction(
  formData: FormData,
): Promise<EmailImageUploadResult> {
  try {
    await requireAdmin();

    const parsed = emailImageUploadSchema.safeParse({
      file: formData.get("file"),
    });
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Choose a valid image.",
      };
    }

    const { file } = parsed.data;
    return await storeEmailImage(
      Buffer.from(await file.arrayBuffer()),
      file.name,
    );
  } catch (error) {
    console.error("[email-image] upload failed:", error);
    return {
      ok: false,
      error: "We couldn't upload that image. Try a JPG or PNG.",
    };
  }
}

/**
 * Bring in a picture the owner pasted as a link.
 *
 * Copying an image out of a web page or a doc puts no file on the clipboard —
 * only HTML with a remote `<img src>`. Without this, that paste does nothing,
 * which is precisely what owners reported as "it won't let me paste".
 *
 * The URL is user-chosen, so `fetchRemoteImage` carries the SSRF guards; this
 * only decides who may ask.
 */
export async function importEmailImageFromUrlAction(
  url: string,
): Promise<EmailImageUploadResult> {
  try {
    await requireAdmin();

    if (typeof url !== "string" || url.length > 2048) {
      return { ok: false, error: "That link can't be used." };
    }

    const fetched = await fetchRemoteImage(url);
    if (!fetched.ok) return { ok: false, error: fetched.error };

    return await storeEmailImage(fetched.data, fetched.fileName);
  } catch (error) {
    console.error("[email-image] url import failed:", error);
    return {
      ok: false,
      error: "We couldn't bring that image in. Save it and drag it in instead.",
    };
  }
}

/** Process, store, and mint a handle. Shared by both ways an image arrives. */
async function storeEmailImage(
  input: Buffer,
  fileName: string,
): Promise<EmailImageUploadResult> {
  const storage = getEmailMediaStorage();
  if (!storage) {
    return {
      ok: false,
      error:
        "Email image hosting is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  const bucketReady = await ensureStorageBucket(storage);
  if (!bucketReady.ok) return bucketReady;

  let processed: { data: Buffer; width: number };
  try {
    processed = await optimizeEmailImage(input);
  } catch (error) {
    console.error("[email-image] processing failed:", error);
    return {
      ok: false,
      error:
        "That image couldn't be processed. Try exporting it as a JPG or PNG and upload again.",
    };
  }

  const id = buildEmailImageId(randomBytes(8).toString("hex"), processed.width);
  const path = emailImageObjectPath(id);
  if (!path) {
    // Unreachable: buildEmailImageId already refuses an id this cannot resolve.
    return { ok: false, error: "We couldn't store that image. Try again." };
  }

  const uploaded = await uploadStorageObject(
    storage,
    path,
    processed.data,
    "image/jpeg",
  );
  if (!uploaded.ok) return uploaded;

  return {
    ok: true,
    id,
    url: storagePublicUrl(storage, path),
    // A filename beats an empty alt attribute: blocked images are the default in
    // several inboxes, and alt text is all those readers get. The owner edits it
    // in the composer tray from there.
    alt: altTextFromFileName(fileName),
    width: processed.width,
  };
}
