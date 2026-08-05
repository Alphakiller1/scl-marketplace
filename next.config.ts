import type { NextConfig } from "next";

function supabaseImagePatterns(): NonNullable<
  NextConfig["images"]
>["remotePatterns"] {
  const url = process.env.SUPABASE_URL?.trim();
  if (!url) {
    return [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ];
  }
  try {
    const { hostname } = new URL(url);
    return [
      {
        protocol: "https",
        hostname,
        pathname: "/storage/v1/object/public/**",
      },
    ];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  // Profile media server actions accept up to 5 MB (cover) plus multipart
  // overhead — the default 1 MB Server Action limit rejects most phone photos.
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
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
