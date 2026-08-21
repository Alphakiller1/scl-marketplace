import type { NextConfig } from "next";

function supabaseImagePatterns(): NonNullable<
  NextConfig["images"]
>["remotePatterns"] {
  // Always allow every Supabase project's public storage bucket. Production
  // avatars may live on a different project host than SUPABASE_URL (e.g. media
  // project vs database project). Narrowing to one hostname caused
  // INVALID_IMAGE_OPTIMIZE_REQUEST 400s for live profile photos.
  const patterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
    {
      protocol: "https",
      hostname: "*.supabase.co",
      pathname: "/storage/v1/object/public/**",
    },
  ];
  const url = process.env.SUPABASE_URL?.trim();
  if (!url) return patterns;
  try {
    const { hostname } = new URL(url);
    if (hostname && hostname !== "*.supabase.co") {
      patterns.push({
        protocol: "https",
        hostname,
        pathname: "/storage/v1/object/public/**",
      });
    }
  } catch {
    // Keep the wildcard fallback above.
  }
  return patterns;
}

const nextConfig: NextConfig = {
  // Profile media server actions accept up to 5 MB (cover) plus multipart
  // overhead — the default 1 MB Server Action limit rejects most phone photos.
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
      // www and apex both serve the app with no redirect. Server Actions
      // reject a POST whose Origin does not match Host — that throw is the
      // live "We couldn't save your profile" toast. Allow both public hosts.
      allowedOrigins: [
        "sportscappersleaderboard.com",
        "www.sportscappersleaderboard.com",
        "scl-marketplace.vercel.app",
      ],
    },
  },
  images: {
    remotePatterns: [
      ...(supabaseImagePatterns() ?? []),
      {
        protocol: "https",
        hostname: "a.espncdn.com",
        pathname: "/i/teamlogos/**",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/cappers",
        destination: "/discover",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
