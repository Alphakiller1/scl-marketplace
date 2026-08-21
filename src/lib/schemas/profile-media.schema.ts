import { z } from "zod";

export const PROFILE_MEDIA_LIMITS = {
  // Phone camera rolls routinely exceed 2 MB before Sharp compresses to WebP.
  // The Server Action body cap is 6 MB (see next.config.ts); keep both kinds under
  // that ceiling with room for multipart overhead.
  avatar: 5 * 1024 * 1024,
  banner: 5 * 1024 * 1024,
} as const;

export type ProfileMediaKind = "avatar" | "banner";

const allowedImageTypes = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

type AllowedImageType = (typeof allowedImageTypes)[number];

const extensionToMime: Record<string, AllowedImageType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

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
  if (!Number.isFinite(byteSize) || byteSize <= 0) return false;
  return byteSize > PROFILE_MEDIA_LIMITS[kind];
}

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
export function resolveProfileMediaMimeType(
  file: File,
): AllowedImageType | null {
  const declared = file.type.trim().toLowerCase();
  if (declared === "image/jpg") return "image/jpeg";
  if (allowedImageTypes.includes(declared as AllowedImageType)) {
    return declared as AllowedImageType;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension) return null;
  return extensionToMime[extension] ?? null;
}

const uploadFileSchema = z.custom<File>(
  isUploadedImageFile,
  "Choose an image to upload.",
);

export const profileMediaSchema = z
  .object({
    kind: z.enum(["avatar", "banner"]),
    file: uploadFileSchema,
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
