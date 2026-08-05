import { z } from "zod";

export const PROFILE_MEDIA_LIMITS = {
  avatar: 2 * 1024 * 1024,
  banner: 5 * 1024 * 1024,
} as const;

const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"] as const;

type AllowedImageType = (typeof allowedImageTypes)[number];

const extensionToMime: Record<string, AllowedImageType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Some mobile browsers send an empty or generic MIME type for valid images. */
export function resolveProfileMediaMimeType(
  file: File,
): AllowedImageType | null {
  if (allowedImageTypes.includes(file.type as AllowedImageType)) {
    return file.type as AllowedImageType;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension) return null;
  return extensionToMime[extension] ?? null;
}

const uploadFileSchema = z.custom<File>(
  (value) => typeof File !== "undefined" && value instanceof File,
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
        message: "Use a JPG, PNG, or WebP image.",
      });
    }

    if (file.size > PROFILE_MEDIA_LIMITS[kind]) {
      ctx.addIssue({
        code: "custom",
        path: ["file"],
        message:
          kind === "avatar"
            ? "Avatar images must be under 2 MB."
            : "Cover images must be under 5 MB.",
      });
    }
  });

export type ProfileMediaKind = z.infer<typeof profileMediaSchema>["kind"];
