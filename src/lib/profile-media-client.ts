"use client";

import { isHeicUpload } from "@/lib/profile-media-format";

/**
 * Mac Photos and iPhone camera rolls default to HEIC. Sharp on Vercel cannot
 * decode patent-encumbered HEIC — convert in the browser before upload.
 */
export async function normalizeProfileMediaFile(file: File): Promise<File> {
  if (!isHeicUpload(file.name, file.type)) return file;

  const heic2any = (await import("heic2any")).default;
  const converted = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.88,
  });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  if (!(blob instanceof Blob)) {
    throw new Error("HEIC conversion failed.");
  }

  const baseName = file.name.replace(/\.(heic|heif)$/i, "") || "photo";
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}
