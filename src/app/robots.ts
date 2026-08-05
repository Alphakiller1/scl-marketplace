import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const BASE_URL = siteUrl();
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
