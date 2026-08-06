import "server-only";

import {
  supabaseProfileMediaBucket,
  supabaseProjectUrl,
  supabaseServiceRoleKey,
  usesSupabasePlatformSecretKey,
} from "@/lib/supabase-config";

export type ProfileMediaStorage = {
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
  storage: ProfileMediaStorage,
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

export function getProfileMediaStorage(): ProfileMediaStorage | null {
  const projectUrl = supabaseProjectUrl();
  const serviceRoleKey = supabaseServiceRoleKey();
  const bucket = supabaseProfileMediaBucket();

  if (!projectUrl || !serviceRoleKey) return null;

  return { bucket, projectUrl, serviceRoleKey };
}

function bucketExistsResponse(status: number): boolean {
  return status === 200;
}

function bucketMissingResponse(status: number): boolean {
  return status === 404;
}

async function listBucketNames(
  storage: ProfileMediaStorage,
): Promise<string[] | null> {
  const response = await storageRequest(storage, "/bucket");
  if (!response.ok) {
    console.error(
      "[profile-media] bucket list failed:",
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

async function createProfileMediaBucket(
  storage: ProfileMediaStorage,
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

  console.error("[profile-media] bucket create failed:", response.status, body);
  return {
    ok: false,
    error:
      "Profile media storage is unavailable. In Supabase → Storage, create a public bucket named scl-profile-media.",
  };
}

export async function ensureProfileMediaBucket(
  storage: ProfileMediaStorage,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const lookup = await storageRequest(
    storage,
    `/bucket/${encodeURIComponent(storage.bucket)}`,
  );
  if (bucketExistsResponse(lookup.status)) return { ok: true };

  if (!bucketMissingResponse(lookup.status)) {
    console.error(
      "[profile-media] bucket lookup failed:",
      lookup.status,
      await lookup.text(),
    );
  }

  const names = await listBucketNames(storage);
  if (names?.includes(storage.bucket)) return { ok: true };

  return createProfileMediaBucket(storage);
}

export async function uploadProfileMediaObject(
  storage: ProfileMediaStorage,
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
  console.error("[profile-media] upload failed:", response.status, message);

  const normalized = message.toLowerCase();
  if (normalized.includes("invalid jwt") || normalized.includes("api key")) {
    return {
      ok: false,
      error:
        "Profile media credentials were rejected. Use the Supabase Secret key (sb_secret_…) or legacy service_role key in SUPABASE_SERVICE_ROLE_KEY.",
    };
  }
  if (response.status === 404 || normalized.includes("bucket not found")) {
    return {
      ok: false,
      error:
        "Profile media bucket not found. In Supabase → Storage, create a public bucket named scl-profile-media.",
    };
  }

  return { ok: false, error: "We couldn't upload that image." };
}

export function profileMediaPublicUrl(
  storage: ProfileMediaStorage,
  path: string,
): string {
  return `${storageBaseUrl(storage.projectUrl)}/storage/v1/object/public/${encodeURIComponent(storage.bucket)}/${path}`;
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

  const ready = await ensureProfileMediaBucket(storage);
  return {
    configured: true,
    bucketReady: ready.ok,
    bucket: storage.bucket,
  };
}
