import "server-only";

import { createClient } from "@supabase/supabase-js";

import {
  supabaseProfileMediaBucket,
  supabaseProjectUrl,
  supabaseServiceRoleKey,
} from "@/lib/supabase-config";

type ProfileMediaStorage = {
  bucket: string;
  client: ReturnType<typeof createClient>;
};

export function getProfileMediaStorage(): ProfileMediaStorage | null {
  const url = supabaseProjectUrl();
  const serviceRoleKey = supabaseServiceRoleKey();
  const bucket = supabaseProfileMediaBucket();

  if (!url || !serviceRoleKey) return null;

  return {
    bucket,
    client: createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }),
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
