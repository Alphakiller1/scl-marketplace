import { Badge } from "@/components/ui/badge";
import { etDayBounds } from "@/lib/et-day";
import type { RecentSystemEmailActivity } from "@/lib/queries/system-email-activity";

const ET = "America/New_York";
const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: ET });
const dayLabelFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: ET,
  weekday: "long",
  month: "short",
  day: "numeric",
});
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: ET,
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

function dayKey(date: Date): string {
  return dayKeyFormatter.format(date);
}

function relativeDayLabel(date: Date, now: Date): string {
  const current = dayKey(now);
  const yesterday = etDayBounds(-1, now).start;
  const key = dayKey(date);
  if (key === current) return "Today";
  if (key === dayKey(yesterday)) return "Yesterday";
  return dayLabelFormatter.format(date);
}

export function RecentEmailActivity({
  rows,
  storageReady,
  now,
}: {
  rows: RecentSystemEmailActivity[];
  storageReady: boolean;
  now: Date;
}) {
  const groups = new Map<string, RecentSystemEmailActivity[]>();
  for (const row of rows) {
    const key = dayKey(row.createdAt);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }

  if (!storageReady) {
    return (
      <p className="border-destructive/40 bg-destructive/5 rounded-xl border p-4 text-sm">
        Email activity storage is not ready. Apply the included migration before
        relying on this log.
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="border-border bg-card rounded-xl border p-6 text-center">
        <p className="font-medium">
          No automated email activity in the last 14 days
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          Welcome emails, verification reminders, and no-plays follow-ups will
          appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <div
      className="border-border bg-card max-h-[42rem] overflow-y-auto rounded-xl border"
      tabIndex={0}
      aria-label="Recent automated email activity from the last 14 days"
    >
      <div className="border-border bg-surface-2 text-muted-foreground sticky top-0 z-20 hidden grid-cols-[9rem_minmax(10rem,1.15fr)_minmax(9rem,1fr)_minmax(12rem,1.4fr)_6rem] gap-3 border-b px-4 py-2 text-xs font-medium tracking-wide uppercase md:grid">
        <span>Date/time</span>
        <span>Email type</span>
        <span>Capper username</span>
        <span>Email address</span>
        <span>Status</span>
      </div>

      {[...groups.values()].map((group) => {
        const first = group[0];
        return (
          <section
            key={dayKey(first.createdAt)}
            aria-label={relativeDayLabel(first.createdAt, now)}
          >
            <h3 className="border-border bg-background/95 sticky top-0 z-10 border-y px-4 py-2 text-sm font-semibold backdrop-blur md:top-9">
              {relativeDayLabel(first.createdAt, now)}
            </h3>
            <div className="divide-border divide-y">
              {group.map((row) => (
                <article
                  key={row.id}
                  className="grid gap-3 p-4 md:grid-cols-[9rem_minmax(10rem,1.15fr)_minmax(9rem,1fr)_minmax(12rem,1.4fr)_6rem] md:items-center"
                >
                  <ActivityField label="Date/time">
                    <time dateTime={row.createdAt.toISOString()}>
                      {dateTimeFormatter.format(row.createdAt)}
                    </time>
                  </ActivityField>
                  <ActivityField label="Email type">
                    {row.emailTypeLabel}
                  </ActivityField>
                  <ActivityField label="Capper username">
                    {row.recipientUsername ? `@${row.recipientUsername}` : "—"}
                  </ActivityField>
                  <ActivityField label="Email address" breakAll>
                    {row.recipientEmail}
                  </ActivityField>
                  <ActivityField label="Status">
                    <Badge
                      variant={
                        row.status === "SENT" ? "outline" : "destructive"
                      }
                      className={
                        row.status === "SENT"
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : undefined
                      }
                      title={row.failureReason ?? undefined}
                    >
                      {row.status === "SENT" ? "Sent" : "Failed"}
                    </Badge>
                    {row.failureReason ? (
                      <span className="text-destructive mt-1 block text-xs md:sr-only">
                        {row.failureReason}
                      </span>
                    ) : null}
                  </ActivityField>
                  {row.failureReason ? (
                    <p className="text-destructive hidden text-xs md:col-span-4 md:col-start-2 md:block">
                      Failure: {row.failureReason}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ActivityField({
  label,
  children,
  breakAll = false,
}: {
  label: string;
  children: React.ReactNode;
  breakAll?: boolean;
}) {
  return (
    <div className={breakAll ? "min-w-0 break-all" : "min-w-0"}>
      <span className="text-muted-foreground mb-1 block text-xs font-medium md:hidden">
        {label}
      </span>
      <div className="text-sm">{children}</div>
    </div>
  );
}
