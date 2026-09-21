export interface SafeServerErrorEvent {
  event: "claimgrid.server_error";
  errorKind: string;
  fingerprint: string;
  method: string;
  route: string;
  routeType: string;
  renderSource?: string;
  release?: string;
  occurredAt: string;
  privacy: "no-request-content";
}

function boundedLabel(value: unknown, fallback: string, maxLength = 80): string {
  return typeof value === "string" && /^[a-zA-Z0-9_ ./:[\]()-]+$/.test(value) && value.length <= maxLength
    ? value
    : fallback;
}

function fingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `cg-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function createSafeServerErrorEvent(input: {
  error: unknown;
  method: unknown;
  route: unknown;
  routeType: unknown;
  renderSource?: unknown;
  release?: unknown;
  now?: Date;
}): SafeServerErrorEvent {
  const errorKind = boundedLabel(input.error instanceof Error ? input.error.name : undefined, "UnknownError", 50);
  const method = boundedLabel(input.method, "UNKNOWN", 12).toUpperCase();
  const route = boundedLabel(input.route, "unknown-route", 120);
  const routeType = boundedLabel(input.routeType, "unknown", 30);
  const renderSource = input.renderSource ? boundedLabel(input.renderSource, "unknown", 50) : undefined;
  const release = input.release ? boundedLabel(input.release, "unknown", 64) : undefined;
  return {
    event: "claimgrid.server_error",
    errorKind,
    fingerprint: fingerprint(`${errorKind}|${method}|${route}|${routeType}|${renderSource ?? ""}`),
    method,
    route,
    routeType,
    ...(renderSource ? { renderSource } : {}),
    ...(release ? { release } : {}),
    occurredAt: (input.now ?? new Date()).toISOString(),
    privacy: "no-request-content"
  };
}
