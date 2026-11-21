/** Reuse one request ID if a successful write loses its response on the network. */
export async function sendSiteVisit(
  path: string,
  requestId: string,
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch("/api/site-visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, requestId }),
        credentials: "same-origin",
        keepalive: true,
        signal: AbortSignal.timeout(8_000),
      });
      if (response.ok) return;
      if (response.status < 500 && response.status !== 429) return;
    } catch {
      // A retry keeps the same identity even if the first insert committed.
    }
    if (attempt < 2) {
      await new Promise((resolve) =>
        setTimeout(resolve, 1_000 * (attempt + 1)),
      );
    }
  }
  throw new Error("Visit unavailable");
}
