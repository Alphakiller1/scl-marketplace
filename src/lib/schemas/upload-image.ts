import { z } from "zod";

/**
 * What counts as an uploaded image, shared by every upload surface.
 *
 * Extracted from `profile-media.schema.ts` when admin email images became the
 * second consumer. The MIME table is the part worth sharing: mobile browsers
 * routinely send a blank or generic `type` for a perfectly good photo, and the
 * extension fallback below is what stopped those uploads from being rejected.
 */

const ALLOWED_UPLOAD_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export type AllowedUploadImageType =
  (typeof ALLOWED_UPLOAD_IMAGE_TYPES)[number];

const extensionToMime: Record<string, AllowedUploadImageType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

function isUploadedImageFile(value: unknown): value is File {
  if (typeof value !== "object" || value === null) return false;
  const file = value as File;
  return (
    typeof file.size === "number" &&
    typeof file.name === "string" &&
    typeof file.arrayBuffer === "function"
  );
}

/** Some mobile browsers send an empty or generic MIME type for valid images. */
export function resolveUploadImageMimeType(
  file: File,
): AllowedUploadImageType | null {
  const declared = file.type.trim().toLowerCase();
  if (declared === "image/jpg") return "image/jpeg";
  if (ALLOWED_UPLOAD_IMAGE_TYPES.includes(declared as AllowedUploadImageType)) {
    return declared as AllowedUploadImageType;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension) return null;
  return extensionToMime[extension] ?? null;
}

export const uploadImageFileSchema = z.custom<File>(
  isUploadedImageFile,
  "Choose an image to upload.",
);

/**
 * A ceiling, never a floor. Camera-roll thumbnails and compressed exports (tens
 * of KB) must upload; only payloads above the cap are rejected — a catch-all
 * size toast once turned "under 5 MB" into a rejection of small files.
 */
export function exceedsUploadImageSizeLimit(
  byteSize: number,
  limitBytes: number,
): boolean {
  if (!Number.isFinite(byteSize) || byteSize <= 0) return false;
  return byteSize > limitBytes;
}
