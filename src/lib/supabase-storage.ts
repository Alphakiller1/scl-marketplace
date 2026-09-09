import "server-only";

import {
  supabaseCredentialMismatch,
  supabaseEmailMediaBucket,
  supabaseProfileMediaBucket,
  supabaseProjectUrl,
  supabaseServiceRoleKey,
  usesSupabasePlatformSecretKey,
} from "@/lib/supabase-config";

/**
 * A resolved Supabase Storage target. Two buckets use this: capper profile media
 * and images an admin drops into an email.
 */
export type SupabaseBucket = {
  bucket: string;
  projectUrl: string;
  serviceRoleKey: string;
};

function storageBaseUrl(projectUrl: string): string {
  return projectUrl.replace(/\/+$/, "");
}

function storageAuthHeaders(serviceRoleKey: string): HeadersInit {
  const headers: Record<string, string> = {
    apikey: serviceRoleKey,
  };
  if (!usesSupabasePlatformSecretKey(serviceRoleKey)) {
    headers.Authorization = `Bearer ${serviceRoleKey}`;
  }
  return headers;
}

async function storageRequest(
  storage: SupabaseBucket,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers ?? {});
  for (const [key, value] of Object.entries(
    storageAuthHeaders(storage.serviceRoleKey),
  )) {
    headers.set(key, value);
  }

  return fetch(`${storageBaseUrl(storage.projectUrl)}/storage/v1${path}`, {
    ...init,
    headers,
  });
}

function resolveBucket(bucket: string): SupabaseBucket | null {
  const projectUrl = supabaseProjectUrl();
  const serviceRoleKey = supabaseServiceRoleKey();

  if (!projectUrl || !serviceRoleKey) return null;

  return { bucket, projectUrl, serviceRoleKey };
}

export function getProfileMediaStorage(): SupabaseBucket | null {
  return resolveBucket(supabaseProfileMediaBucket());
}

export function getEmailMediaStorage(): SupabaseBucket | null {
  return resolveBucket(supabaseEmailMediaBucket());
}

function bucketExistsResponse(status: number): boolean {
  return status === 200;
}

function bucketMissingResponse(status: number): boolean {
  return status === 404;
}

async function listBucketNames(
  storage: SupabaseBucket,
): Promise<string[] | null> {
  const response = await storageRequest(storage, "/bucket");
  if (!response.ok) {
    console.error(
      "[storage] bucket list failed:",
      response.status,
      await response.text(),
    );
    return null;
  }

  const payload = (await response.json()) as Array<{ name?: string }>;
  return payload
    .map((entry) => entry.name)
    .filter((name): name is string => Boolean(name));
}

async function createStorageBucket(
  storage: SupabaseBucket,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const response = await storageRequest(storage, "/bucket", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: storage.bucket,
      public: true,
    }),
  });

  if (response.ok) return { ok: true };

  const body = await response.text();
  if (/already exists/i.test(body)) return { ok: true };

  console.error("[storage] bucket create failed:", response.status, body);

  // "Create the bucket" is the wrong instruction when the bucket exists and the
  // credentials simply name two different projects — that advice sent one
  // investigation into creating a second, unused bucket in the wrong project.
  const mismatch = supabaseCredentialMismatch();
  if (mismatch) {
    return {
      ok: false,
      error: `Supabase credentials point at two different projects - SUPABASE_URL is ${mismatch.urlRef} but the service-role key belongs to ${mismatch.keyRef}. Set both from the same project.`,
    };
  }

  const normalized = body.toLowerCase();
  if (
    response.status === 401 ||
    response.status === 403 ||
    normalized.includes("invalid jwt") ||
    normalized.includes("api key")
  ) {
    return {
      ok: false,
      error:
        "Storage credentials were rejected. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY belong to the same Supabase project.",
    };
  }

  return {
    ok: false,
    error: `Storage is unavailable (${response.status}). In Supabase → Storage, create a public bucket named ${storage.bucket}.`,
  };
}

export async function ensureStorageBucket(
  storage: SupabaseBucket,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const lookup = await storageRequest(
    storage,
    `/bucket/${encodeURIComponent(storage.bucket)}`,
  );
  if (bucketExistsResponse(lookup.status)) return { ok: true };

  if (!bucketMissingResponse(lookup.status)) {
    console.error(
      "[storage] bucket lookup failed:",
      lookup.status,
      await lookup.text(),
    );
  }

  const names = await listBucketNames(storage);
  if (names?.includes(storage.bucket)) return { ok: true };

  return createStorageBucket(storage);
}

export async function uploadStorageObject(
  storage: SupabaseBucket,
  path: string,
  body: Buffer,
  contentType: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const response = await storageRequest(
    storage,
    `/object/${encodeURIComponent(storage.bucket)}/${path}`,
    {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        "x-upsert": "true",
        "cache-control": "3600",
      },
      body: new Uint8Array(body),
    },
  );

  if (response.ok) return { ok: true };

  const message = await response.text();
  console.error("[storage] upload failed:", response.status, message);

  // Say so before blaming the key or the bucket: a cross-project pair fails as
  // either one, and both misreadings send you looking in the wrong project.
  const mismatch = supabaseCredentialMismatch();
  if (mismatch) {
    return {
      ok: false,
      error: `Supabase credentials point at two different projects - SUPABASE_URL is ${mismatch.urlRef} but the service-role key belongs to ${mismatch.keyRef}. Set both from the same project.`,
    };
  }

  const normalized = message.toLowerCase();
  if (normalized.includes("invalid jwt") || normalized.includes("api key")) {
    return {
      ok: false,
      error:
        "Storage credentials were rejected. Use the Supabase Secret key (sb_secret_…) or legacy service_role key in SUPABASE_SERVICE_ROLE_KEY.",
    };
  }
  if (response.status === 404 || normalized.includes("bucket not found")) {
    return {
      ok: false,
      error: `Storage bucket not found. In Supabase → Storage, create a public bucket named ${storage.bucket}.`,
    };
  }

  return { ok: false, error: "We couldn't upload that image." };
}

export function storagePublicUrl(
  storage: SupabaseBucket,
  path: string,
): string {
  return `${storageBaseUrl(storage.projectUrl)}/storage/v1/object/public/${encodeURIComponent(storage.bucket)}/${path}`;
}

/**
 * Is this object actually fetchable by an anonymous client?
 *
 * A HEAD on the *public* URL rather than the admin API on purpose: it exercises
 * the exact request a recipient's mail client will make, so a bucket that has
 * quietly stopped being public fails here rather than in 136 inboxes.
 */
export async function storageObjectIsPublic(
  storage: SupabaseBucket,
  path: string,
): Promise<boolean> {
  try {
    const response = await fetch(storagePublicUrl(storage, path), {
      method: "HEAD",
      cache: "no-store",
    });
    return response.ok;
  } catch (error) {
    console.error("[storage] public HEAD failed:", path, error);
    return false;
  }
}

/** Live probe used by /api/health — env vars alone are not enough. */
export async function probeProfileMediaStorage(): Promise<{
  configured: boolean;
  bucketReady: boolean;
  bucket: string;
}> {
  const storage = getProfileMediaStorage();
  if (!storage) {
    return {
      configured: false,
      bucketReady: false,
      bucket: supabaseProfileMediaBucket(),
    };
  }

  const ready = await ensureStorageBucket(storage);
  return {
    configured: true,
    bucketReady: ready.ok,
    bucket: storage.bucket,
  };
}
