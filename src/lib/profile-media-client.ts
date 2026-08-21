"use client";

import { isHeicUpload } from "@/lib/profile-media-format";

async function fileLooksLikeHeic(file: File): Promise<boolean> {
  if (isHeicUpload(file.name, file.type)) return true;
  if (file.size < 12) return false;
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

/**
 * Mac Photos and iPhone camera rolls default to HEIC. Sharp on Vercel cannot
 * decode patent-encumbered HEIC — convert in the browser before upload.
 * Also inspects the file header because Safari often omits `.heic` / MIME.
 */
export async function normalizeProfileMediaFile(file: File): Promise<File> {
  if (!(await fileLooksLikeHeic(file))) return file;

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
