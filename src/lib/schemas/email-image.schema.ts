import { z } from "zod";

import {
  exceedsUploadImageSizeLimit,
  resolveUploadImageMimeType,
  uploadImageFileSchema,
} from "@/lib/schemas/upload-image";

/**
 * Same 5 MB ceiling as profile media, and for the same reason: the Server Action
 * body cap is 6 MB (see next.config.ts), and a slate graphic straight out of a
 * design tool clears 2 MB easily.
 */
export const EMAIL_IMAGE_SIZE_LIMIT = 5 * 1024 * 1024;

export const EMAIL_IMAGE_SIZE_LIMIT_MESSAGE =
  "Email images must be under 5 MB.";

export function exceedsEmailImageSizeLimit(byteSize: number): boolean {
  return exceedsUploadImageSizeLimit(byteSize, EMAIL_IMAGE_SIZE_LIMIT);
}

export const emailImageUploadSchema = z
  .object({ file: uploadImageFileSchema })
  .superRefine(({ file }, ctx) => {
    if (!resolveUploadImageMimeType(file)) {
      ctx.addIssue({
        code: "custom",
        path: ["file"],
        message: "Use a JPG, PNG, WebP, or HEIC image.",
      });
    }

    if (exceedsEmailImageSizeLimit(file.size)) {
      ctx.addIssue({
        code: "custom",
        path: ["file"],
        message: EMAIL_IMAGE_SIZE_LIMIT_MESSAGE,
      });
    }
  });
