import type { MetadataRoute } from "next";

const BASE_URL = "https://scl-marketplace.vercel.app";

/**
 * Static core surfaces only — capper profiles churn (and demo records will be
 * wiped at launch), so we keep the sitemap to the stable marketing pages and
 * let crawlers discover profiles through the leaderboard/discover links.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const page = (
    path: string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
  ) => ({
    url: `${BASE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  });

  return [
    page("/", 1, "hourly"),
    page("/leaderboard", 0.9, "hourly"),
    page("/discover", 0.8, "daily"),
    page("/picks", 0.8, "hourly"),
    page("/packages", 0.7, "daily"),
    page("/verification", 0.6, "monthly"),
    page("/support", 0.5, "monthly"),
    page("/signup", 0.6, "monthly"),
    page("/login", 0.4, "monthly"),
    page("/terms", 0.2, "yearly"),
    page("/privacy", 0.2, "yearly"),
    page("/disclaimer", 0.2, "yearly"),
    page("/responsible-gaming", 0.2, "yearly"),
  ];
}
