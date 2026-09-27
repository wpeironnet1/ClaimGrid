export const ACCOUNT_DELETION_CONFIRMATION = "DELETE MY ACCOUNT";

function isHttpsEndpoint(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && !url.hash; }
  catch { return false; }
}

export function accountDeletionConfiguration(environment: Record<string, string | undefined>) {
  const endpointConfigured = isHttpsEndpoint(environment.CLAIMGRID_ACCOUNT_DELETE_URL);
  const tokenConfigured = typeof environment.CLAIMGRID_ACCOUNT_DELETE_TOKEN === "string" && environment.CLAIMGRID_ACCOUNT_DELETE_TOKEN.length >= 32;
  return { ready: endpointConfigured && tokenConfigured, endpointConfigured, tokenConfigured };
}

export function isAccountDeletionConfirmed(value: unknown): boolean {
  return !!value && typeof value === "object" && (value as { confirmation?: unknown }).confirmation === ACCOUNT_DELETION_CONFIRMATION;
}

export interface AccountDeletionAcknowledgement { accountId: string; deleted: true; deletedAt: string }

export function parseAccountDeletionAcknowledgement(value: unknown, expectedAccountId: string): AccountDeletionAcknowledgement | null {
  if (!value || typeof value !== "object") return null;
  const result = value as { accountId?: unknown; deleted?: unknown; deletedAt?: unknown };
  if (result.accountId !== expectedAccountId || result.deleted !== true || typeof result.deletedAt !== "string" || !Number.isFinite(Date.parse(result.deletedAt))) return null;
  return { accountId: expectedAccountId, deleted: true, deletedAt: result.deletedAt };
}
