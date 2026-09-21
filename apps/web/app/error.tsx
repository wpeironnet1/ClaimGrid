"use client";

import { useEffect } from "react";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("ClaimGrid route rendering failed", error); }, [error]);
  return <main className="recoveryPage" role="alert"><section><span>CLAIMGRID RECOVERY</span><h1>This view could not be loaded.</h1><p>Your browser-stored research has not been deleted. Retry this view, or return home and reopen the workflow.</p><div><button onClick={reset}>Try again</button><a href="/">Return home</a></div><small>If the problem continues, preserve a backup from the Privacy page before clearing browser data.</small></section></main>;
}
