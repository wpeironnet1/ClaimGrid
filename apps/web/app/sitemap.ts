import type { MetadataRoute } from "next";
import { PUBLIC_SITE_PATHS } from "@claimgrid/core";
import { getPublicSiteOrigin } from "../lib/site-origin";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getPublicSiteOrigin();
  if (!origin) return [];
  return PUBLIC_SITE_PATHS.map(path => ({
    url: `${origin}${path}`,
    changeFrequency: path === "/" || path === "/explore" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/explore" ? 0.9 : 0.7
  }));
}
