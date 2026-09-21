import type { MetadataRoute } from "next";
import { getPublicSiteOrigin } from "../lib/site-origin";

export default function robots(): MetadataRoute.Robots {
  const origin = getPublicSiteOrigin();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    ...(origin ? { sitemap: `${origin}/sitemap.xml`, host: origin } : {})
  };
}
