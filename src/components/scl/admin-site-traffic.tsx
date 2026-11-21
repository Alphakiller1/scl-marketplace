"use client";

import { Globe } from "lucide-react";
import { useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/scl/section";
import { StatBlock } from "@/components/scl/stat";
import {
  SITE_TRAFFIC_REFRESH_MS,
  type SiteTrafficReport,
} from "@/lib/site-traffic";

const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
  });

export function AdminSiteTraffic({
  data: initialData,
}: {
  data: SiteTrafficReport | null;
}) {
  const [latest, setLatest] = useState(initialData);
  const [updateFailed, setUpdateFailed] = useState(false);
  const data =
    latest && (!initialData || latest.checkedAt >= initialData.checkedAt)
      ? latest
      : initialData;

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    const refresh = async () => {
      if (document.visibilityState !== "visible" || inFlight) return;
      inFlight = true;
      try {
        const response = await fetch("/api/admin/site-traffic", {
          cache: "no-store",
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new Error("Traffic report unavailable");
        const report = (await response.json()) as SiteTrafficReport;
        if (!cancelled) {
          setLatest(report);
          setUpdateFailed(false);
        }
      } catch {
        if (!cancelled) setUpdateFailed(true);
      } finally {
        inFlight = false;
      }
    };
    void refresh();
    const interval = setInterval(() => void refresh(), SITE_TRAFFIC_REFRESH_MS);
    const resume = () => void refresh();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
    };
  }, []);
  const peak = Math.max(1, ...(data?.days.map((day) => day.visits ?? 0) ?? []));
  return (
    <section className="space-y-3" aria-label="Website visits">
      <SectionHeader
        icon={Globe}
        title="Website visits"
        subtitle="Daily browser sessions · Eastern time"
      />
      <Card className="gap-4 p-4 sm:p-5">
        {data ? (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <StatBlock
                label="Today"
                value={data.today.toLocaleString()}
                sub="So far"
              />
              <StatBlock
                label="Yesterday"
                value={data.yesterday?.toLocaleString() ?? "—"}
              />
              <StatBlock
                label="Last 7 days"
                value={data.last7Days.toLocaleString()}
              />
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Each browser session counts once per Eastern day. Sessions expire
              after 30 minutes without a page navigation.
            </p>
            <p
              className="text-muted-foreground text-xs"
              role="status"
              aria-live="polite"
            >
              {updateFailed
                ? "Update delayed. Last successful count"
                : "Updated"}{" "}
              {new Intl.DateTimeFormat("en-US", {
                timeZone: "America/New_York",
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit",
              }).format(new Date(data.checkedAt))}{" "}
              ET. Refreshes every minute.
            </p>
            {data.firstDay ? (
              <>
                <details className="group">
                  <summary className="focus-visible:ring-ring flex min-h-10 cursor-pointer items-center justify-between rounded-md text-sm font-medium outline-none focus-visible:ring-2">
                    Daily breakdown · last 30 days
                    <span className="text-muted-foreground" aria-hidden>
                      ⌄
                    </span>
                  </summary>
                  <ol className="divide-border mt-2 divide-y">
                    {data.days.toReversed().map((day) => (
                      <li
                        key={day.date}
                        className="grid grid-cols-[5rem_minmax(0,1fr)_4rem] items-center gap-3 py-2 text-sm"
                      >
                        <time
                          dateTime={day.date}
                          className="text-muted-foreground"
                        >
                          {dateLabel(day.date)}
                        </time>
                        <div
                          className="bg-surface-2 h-2 overflow-hidden rounded-full"
                          aria-hidden
                        >
                          <div
                            className="bg-primary h-full rounded-full"
                            style={{
                              width: `${((day.visits ?? 0) / peak) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-right tabular-nums">
                          {day.visits?.toLocaleString() ?? "—"}
                        </span>
                      </li>
                    ))}
                  </ol>
                </details>
                <p className="text-muted-foreground text-xs">
                  Tracking began {dateLabel(data.firstDay)}. Earlier dates show
                  —.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-sm" role="status">
                Visit tracking is ready. Counts will appear as people browse
                SCL.
              </p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground text-sm" role="status">
            Visit counts are temporarily unavailable. Retrying automatically
            every minute.
          </p>
        )}
      </Card>
    </section>
  );
}
