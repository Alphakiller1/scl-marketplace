import { z } from "zod";

import {
  exceedsUploadImageSizeLimit,
  resolveUploadImageMimeType,
  uploadImageFileSchema,
  type AllowedUploadImageType,
} from "@/lib/schemas/upload-image";

export const PROFILE_MEDIA_LIMITS = {
  // Phone camera rolls routinely exceed 2 MB before Sharp compresses to WebP.
  // The Server Action body cap is 6 MB (see next.config.ts); keep both kinds under
  // that ceiling with room for multipart overhead.
  avatar: 5 * 1024 * 1024,
  banner: 5 * 1024 * 1024,
} as const;

export type ProfileMediaKind = "avatar" | "banner";

export function profileMediaSizeLimitMessage(kind: ProfileMediaKind): string {
  return kind === "avatar"
    ? "Avatar images must be under 5 MB."
    : "Cover images must be under 5 MB.";
}

/**
 * 5 MB is a ceiling, never a floor. Camera-roll thumbnails and compressed
 * exports (tens of KB) must upload; only payloads above the cap are rejected.
 */
export function exceedsProfileMediaSizeLimit(
  byteSize: number,
  kind: ProfileMediaKind,
): boolean {
  return exceedsUploadImageSizeLimit(byteSize, PROFILE_MEDIA_LIMITS[kind]);
}

/** Some mobile browsers send an empty or generic MIME type for valid images. */
export function resolveProfileMediaMimeType(
  file: File,
): AllowedUploadImageType | null {
  return resolveUploadImageMimeType(file);
}

export const profileMediaSchema = z
  .object({
    kind: z.enum(["avatar", "banner"]),
    file: uploadImageFileSchema,
  })
  .superRefine(({ kind, file }, ctx) => {
    if (!resolveProfileMediaMimeType(file)) {
      ctx.addIssue({
        code: "custom",
        path: ["file"],
        message: "Use a JPG, PNG, WebP, or HEIC photo.",
      });
    }

    if (exceedsProfileMediaSizeLimit(file.size, kind)) {
      ctx.addIssue({
        code: "custom",
        path: ["file"],
        message: profileMediaSizeLimitMessage(kind),
      });
    }
  });
