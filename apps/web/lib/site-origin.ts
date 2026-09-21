import { normalizePublicSiteOrigin } from "@claimgrid/core";

export function getPublicSiteOrigin(): string | null {
  return normalizePublicSiteOrigin(
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL
  );
}
