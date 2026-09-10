import {
  collectEmailImageIds,
  emailImageObjectPath,
  emailImageUrlFrom,
  EMAIL_IMAGE_MAX_PER_EMAIL,
} from "@/lib/email-image";
import {
  supabaseEmailMediaBucket,
  supabaseProjectUrl,
} from "@/lib/supabase-config";

/**
 * Where an email image lives, and whether it can actually be fetched.
 *
 * Deliberately free of `server-only`. Everything here needs the project URL and
 * the bucket name — both public, both already visible in every capper avatar URL
 * on the marketing site — and nothing here needs the service-role key. That is
 * what lets `email.ts` resolve images directly instead of having a resolver
 * threaded through every send function, and it is why an automated template can
 * carry a picture at all.
 *
 * Uploading is the one operation that needs the secret; it lives in
 * `supabase-storage.ts`, which stays `server-only`.
 */

/** `https://<ref>.supabase.co/storage/v1/object/public/<bucket>`, or null. */
export function emailImageBaseUrl(): string | null {
  const projectUrl = supabaseProjectUrl();
  if (!projectUrl) return null;
  const bucket = supabaseEmailMediaBucket();
  return `${projectUrl.replace(/\/+$/, "")}/storage/v1/object/public/${encodeURIComponent(bucket)}`;
}

/** Public URL for one image handle, or null when unusable or unconfigured. */
export function emailImageUrl(id: string): string | null {
  const base = emailImageBaseUrl();
  return base ? emailImageUrlFrom(base, id) : null;
}

/**
 * Resolver for one render pass. Reads the config once rather than per image, so
 * every picture in a single email is guaranteed to come from the same bucket.
 */
export function emailImageUrlResolver(): (id: string) => string | null {
  const base = emailImageBaseUrl();
  if (!base) return () => null;
  return (id) => emailImageUrlFrom(base, id);
}

/**
 * Refuse a send whose images would not load.
 *
 * A mass email cannot be recalled, so an image that 404s is permanent: every
 * recipient sees a broken frame forever. The check is a HEAD against the public
 * URL — the exact request a recipient's mail client will make — so a bucket that
 * has quietly stopped being public fails here rather than in 136 inboxes. No
 * credentials involved, by design: an anonymous fetch is what we are testing.
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

  const base = emailImageBaseUrl();
  if (!base) {
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
      try {
        const response = await fetch(emailImageUrlFrom(base, id) as string, {
          method: "HEAD",
          cache: "no-store",
        });
        return response.ok;
      } catch (error) {
        console.error("[email-image] public HEAD failed:", id, error);
        return false;
      }
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
