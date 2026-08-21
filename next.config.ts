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
  /**
   * Ship libvips with the functions that resize profile media.
   *
   * `sharp` is already on Next's auto-external list, so it is loaded with a
   * native `require` at runtime rather than bundled — but its platform binary
   * lives in an *optional* dependency (`@img/sharp-libvips-linux-x64`), and
   * file tracing was not following the external module into it. The function
   * shipped with `sharp` present and `libvips-cpp.so` absent, so every avatar
   * and cover upload died in `optimizeProfileMediaImage` with
   * ERR_DLOPEN_FAILED and told the capper their photo was the problem:
   *
   *   Could not load the "sharp" module using the linux-x64 runtime
   *   ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.3: cannot open shared object file
   *
   * Keyed by route because tracing is per-function: the upload action is
   * reached from the capper profile page, and `/api/*` covers any future
   * route handler that resizes. Globbed across every `@img` platform package
   * so a sharp upgrade that renames the binary cannot silently re-break it.
   */
  outputFileTracingIncludes: {
    "/dashboard/profile": ["./node_modules/@img/**/*"],
    "/api/*": ["./node_modules/@img/**/*"],
  },

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
