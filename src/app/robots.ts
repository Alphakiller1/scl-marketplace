import type { MetadataRoute } from "next";

const BASE_URL = "https://scl-marketplace.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Workspace, admin, api, tracking redirects, and QA fixtures are not
        // for crawlers — public marketing surfaces are.
        disallow: ["/dashboard", "/admin", "/api/", "/go/", "/qa/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
