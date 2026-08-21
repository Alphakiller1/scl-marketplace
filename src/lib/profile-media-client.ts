"use client";

import { isHeicUpload } from "@/lib/profile-media-format";

async function fileLooksLikeHeic(file: File): Promise<boolean> {
  if (isHeicUpload(file.name, file.type)) return true;
  const headerBytes = Math.min(file.size || 12, 12);
  if (headerBytes < 12) return false;
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const ftyp = String.fromCharCode(
    header[4]!,
    header[5]!,
    header[6]!,
    header[7]!,
  );
  if (ftyp !== "ftyp") return false;
  const brand = String.fromCharCode(
    header[8]!,
    header[9]!,
    header[10]!,
    header[11]!,
  ).toLowerCase();
  return (
    brand === "heic" ||
    brand === "heix" ||
    brand === "hevc" ||
    brand === "hevx" ||
    brand === "mif1" ||
    brand === "msf1"
  );
}

function jpegFileFromBlob(blob: Blob, originalName: string): File {
  const baseName = originalName.replace(/\.(heic|heif)$/i, "") || "photo";
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

/** Safari can decode HEIC natively; Chrome cannot. Never throw. */
async function rasterizeToJpeg(file: File): Promise<File | null> {
  if (
    typeof createImageBitmap !== "function" ||
    typeof document === "undefined"
  ) {
    return null;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, bitmap.width);
    canvas.height = Math.max(1, bitmap.height);
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return null;
    }
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.88),
    );
    return blob ? jpegFileFromBlob(blob, file.name) : null;
  } catch {
    return null;
  }
}

async function convertHeicWithHeic2any(file: File): Promise<File | null> {
  try {
    const heic2any = (await import("heic2any")).default;
    const converted = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.88,
    });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    if (!(blob instanceof Blob)) return null;
    return jpegFileFromBlob(blob, file.name);
  } catch {
    return null;
  }
}

/**
 * Mac Photos and iPhone camera rolls default to HEIC. Sharp on Vercel cannot
 * decode patent-encumbered HEIC — convert in the browser before upload.
 * Conversion failure must not block the upload: the server still tries
 * heic-convert, and a catch-all "under 5 MB" toast was rejecting tiny
 * camera-roll files as if 5 MB were a minimum.
 */
export async function normalizeProfileMediaFile(file: File): Promise<File> {
  if (!(await fileLooksLikeHeic(file))) return file;

  const rasterized = await rasterizeToJpeg(file);
  if (rasterized) return rasterized;

  const converted = await convertHeicWithHeic2any(file);
  if (converted) return converted;

  return file;
}
