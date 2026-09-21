import type { Instrumentation } from "next";
import { createSafeServerErrorEvent } from "@claimgrid/core";

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const event = createSafeServerErrorEvent({
    error,
    method: request.method,
    route: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
    release: process.env.VERCEL_GIT_COMMIT_SHA
  });
  console.error(JSON.stringify(event));
};
