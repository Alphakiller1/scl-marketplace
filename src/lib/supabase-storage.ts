import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  supabaseProfileMediaBucket,
  supabaseProjectUrl,
  supabaseServiceRoleKey,
  usesSupabasePlatformSecretKey,
} from "@/lib/supabase-config";

type ProfileMediaStorage = {
  bucket: string;
  client: SupabaseClient;
};

function createProfileMediaClient(
  url: string,
  serviceRoleKey: string,
): SupabaseClient {
  const auth = {
    autoRefreshToken: false,
    persistSession: false,
  } as const;

  if (!usesSupabasePlatformSecretKey(serviceRoleKey)) {
    return createClient(url, serviceRoleKey, { auth });
  }

  // Supabase rejects sb_secret_* keys when they also ride Authorization: Bearer.
  return createClient(url, serviceRoleKey, {
    auth,
    global: {
      headers: { apikey: serviceRoleKey },
      fetch: (input, init) => {
        const headers = new Headers(init?.headers ?? {});
        headers.set("apikey", serviceRoleKey);
        headers.delete("Authorization");
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export function getProfileMediaStorage(): ProfileMediaStorage | null {
  const url = supabaseProjectUrl();
  const serviceRoleKey = supabaseServiceRoleKey();
  const bucket = supabaseProfileMediaBucket();

  if (!url || !serviceRoleKey) return null;

  return {
    bucket,
    client: createProfileMediaClient(url, serviceRoleKey),
  };
}

export async function ensureProfileMediaBucket({
  bucket,
  client,
}: ProfileMediaStorage): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data } = await client.storage.getBucket(bucket);
  if (data) return { ok: true };

  const { error } = await client.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: "5MB",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });

  if (error && !error.message.toLowerCase().includes("already exists")) {
    console.error("[profile-media] bucket setup failed:", error);
    return { ok: false, error: "Profile media storage is unavailable." };
  }

  return { ok: true };
}
