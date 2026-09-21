export const PUBLIC_SITE_PATHS = [
  "/", "/explore", "/claim/nevada", "/claim/arizona", "/claim/california",
  "/claim/new", "/deadlines", "/documents/nevada", "/legal", "/pricing", "/privacy"
] as const;

export function normalizePublicSiteOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  const candidate = value.trim();
  if (!candidate || /[?#]/.test(candidate)) return null;
  try {
    const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/") return null;
    return url.origin;
  } catch {
    return null;
  }
}
