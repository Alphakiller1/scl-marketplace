import "server-only";

import {
  collectEmailImageIds,
  emailImageObjectPath,
  EMAIL_IMAGE_MAX_PER_EMAIL,
} from "@/lib/email-image";
import {
  getEmailMediaStorage,
  storageObjectIsPublic,
  storagePublicUrl,
} from "@/lib/supabase-storage";

/**
 * The bridge between an image handle in a message and a URL an inbox can fetch.
 *
 * Kept apart from `email.ts` deliberately: this module reaches Supabase Storage
 * and so carries `server-only`, while `email.ts` is imported by unit tests that
 * would die on that import. The mailer takes a resolver as an argument instead.
 */

/**
 * Resolver for one render pass.
 *
 * Reads the storage config once rather than per image, so every picture in a
 * single email is guaranteed to come from the same bucket.
 */
export function emailImageUrlResolver(): (id: string) => string | null {
  const storage = getEmailMediaStorage();
  if (!storage) return () => null;

  return (id) => {
    const path = emailImageObjectPath(id);
    return path ? storagePublicUrl(storage, path) : null;
  };
}

/**
 * Refuse a send whose images would not load.
 *
 * A mass email cannot be recalled, so an image that 404s is permanent: every
 * recipient sees a broken frame forever. Checking each one against the public URL
 * before the first message leaves is cheap (at most
 * {@link EMAIL_IMAGE_MAX_PER_EMAIL} HEAD requests) and it is the only moment when
 * the answer can still change anything.
 */
export async function verifyEmailImagesDeliverable(
  body: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ids = collectEmailImageIds(body);
  if (ids.length === 0) return { ok: true };

  if (ids.length > EMAIL_IMAGE_MAX_PER_EMAIL) {
    return {
      ok: false,
      error: `One email can carry ${EMAIL_IMAGE_MAX_PER_EMAIL} images. Remove ${ids.length - EMAIL_IMAGE_MAX_PER_EMAIL} and send again.`,
    };
  }

  const storage = getEmailMediaStorage();
  if (!storage) {
    return {
      ok: false,
      error:
        "Email image hosting is not configured, so the pictures in this message would not load. Remove them or set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  const checks = await Promise.all(
    ids.map(async (id) => {
      const path = emailImageObjectPath(id);
      if (!path) return false;
      return storageObjectIsPublic(storage, path);
    }),
  );

  const missing = checks.filter((reachable) => !reachable).length;
  if (missing > 0) {
    return {
      ok: false,
      error: `${missing === 1 ? "One image" : `${missing} images`} in this message can no longer be loaded. Remove and re-add ${missing === 1 ? "it" : "them"} before sending.`,
    };
  }

  return { ok: true };
}
