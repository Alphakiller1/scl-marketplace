"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { etYmd } from "@/lib/et-day";
import { isSiteVisitPath, SITE_VISIT_SECONDS } from "@/lib/site-traffic";
import { sendSiteVisit } from "@/lib/site-visit-client";

/** Runs after hydration, so link prefetches and server probes never count. */
export function SiteVisitTracker({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);
  const lastRecordedAt = useRef(0);
  const pending = useRef(Promise.resolve());

  useEffect(() => {
    if (!enabled || !isSiteVisitPath(pathname)) {
      lastPath.current = null;
      return;
    }
    const record = () => {
      const now = Date.now();
      if (
        document.visibilityState !== "visible" ||
        (lastPath.current === pathname &&
          now - lastRecordedAt.current < SITE_VISIT_SECONDS * 1_000 &&
          etYmd(new Date(now)) === etYmd(new Date(lastRecordedAt.current)))
      ) {
        return;
      }
      lastPath.current = pathname;
      lastRecordedAt.current = now;
      const requestId = crypto.randomUUID();
      // Serialize navigations so the first response sets the session cookie
      // before a second request can create another visit.
      pending.current = pending.current
        .then(() => sendSiteVisit(pathname, requestId))
        .catch(() => {
          if (lastPath.current === pathname) lastPath.current = null;
        });
    };
    record();
    document.addEventListener("visibilitychange", record);
    window.addEventListener("online", record);
    window.addEventListener("pageshow", record);
    return () => {
      document.removeEventListener("visibilitychange", record);
      window.removeEventListener("online", record);
      window.removeEventListener("pageshow", record);
    };
  }, [enabled, pathname]);

  return null;
}
