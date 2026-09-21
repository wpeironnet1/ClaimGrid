"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><body><main className="recoveryPage" role="alert"><section><span>CLAIMGRID RECOVERY</span><h1>ClaimGrid needs to restart this view.</h1><p>Locally saved records remain in this browser unless browser storage is cleared. No filing or legal deadline is changed by this screen.</p><div><button onClick={reset}>Restart ClaimGrid</button><a href="/">Return home</a></div></section></main></body></html>;
}
