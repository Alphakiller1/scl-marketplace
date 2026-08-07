import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/scl/section";
import { BroadcastComposer } from "@/components/scl/broadcast-composer";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Email cappers" };

export default async function AdminMessagesPage() {
  await requireAdmin();

  const [cappers, recent] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: "CAPPER",
        accountStatus: { notIn: ["SUSPENDED", "DISABLED"] },
      },
      select: { id: true, username: true, email: true },
      orderBy: { username: "asc" },
    }),
    prisma.adminBroadcast.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        subject: true,
        audience: true,
        recipientCount: true,
        deliveredCount: true,
        failedCount: true,
        createdAt: true,
        completedAt: true,
        sentBy: { select: { username: true } },
      },
    }),
  ]);

  const dateTime = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Email cappers"
        subtitle="Message one capper, or the roster. Announcements carry an unsubscribe link; account and security email always sends."
      />

      <BroadcastComposer
        cappers={cappers.map((c) => ({
          id: c.id,
          label: c.username ? `@${c.username}` : c.email,
        }))}
      />

      <Card className="p-4">
        <h2 className="scl-display text-sm font-semibold tracking-wide">
          Recent sends
        </h2>
        {recent.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">
            Nothing sent yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {recent.map((b) => (
              <li
                key={b.id}
                className="border-border flex flex-wrap items-baseline justify-between gap-2 border-b pb-3 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{b.subject}</p>
                  <p className="text-muted-foreground text-xs">
                    {b.audience.replace(/_/g, " ").toLowerCase()} ·{" "}
                    {b.sentBy?.username ? `@${b.sentBy.username}` : "admin"} ·{" "}
                    {dateTime.format(b.createdAt)}
                  </p>
                </div>
                <p className="text-xs tabular-nums">
                  {/* Honest while in flight: an un-completed send has counts that
                      are still climbing, and showing 0/136 as if final would read
                      as a total failure. */}
                  {b.completedAt
                    ? `${b.deliveredCount} delivered${b.failedCount > 0 ? ` · ${b.failedCount} failed` : ""}`
                    : `sending to ${b.recipientCount}…`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
