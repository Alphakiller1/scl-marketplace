"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { isSiteVisitPath } from "@/lib/site-traffic";

/** Runs after hydration, so link prefetches and server probes never count. */
export function SiteVisitTracker({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);
  const pending = useRef(Promise.resolve());

  useEffect(() => {
    if (!enabled || !isSiteVisitPath(pathname)) {
      lastPath.current = null;
      return;
    }
    const record = () => {
      if (
        document.visibilityState !== "visible" ||
        lastPath.current === pathname
      ) {
        return;
      }
      lastPath.current = pathname;
      // Serialize navigations so the first response sets the session cookie
      // before a second request can create another visit.
      pending.current = pending.current
        .then(async () => {
          const response = await fetch("/api/site-visits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: pathname }),
            credentials: "same-origin",
            keepalive: true,
          });
          if (!response.ok) throw new Error("Visit unavailable");
        })
        .catch(() => {
          if (lastPath.current === pathname) lastPath.current = null;
        });
    };
    record();
    document.addEventListener("visibilitychange", record);
    return () => document.removeEventListener("visibilitychange", record);
  }, [enabled, pathname]);

  return null;
}
