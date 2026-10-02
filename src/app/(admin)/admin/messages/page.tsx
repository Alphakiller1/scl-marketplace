import { Send } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/scl/section";
import { BroadcastComposer } from "@/components/scl/broadcast-composer";
import { requireAdmin } from "@/lib/session";
import { emailImageBaseUrl } from "@/lib/email-image-url";
import { audienceFiltersSchema } from "@/lib/schemas/audience.schema";

export const metadata = { title: "Mass email" };
export const maxDuration = 300;

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ filters?: string }>;
}) {
  const admin = await requireAdmin();
  const rawFilters = (await searchParams).filters;
  let initialFilters;
  if (rawFilters) {
    try {
      const parsed = audienceFiltersSchema.safeParse(JSON.parse(rawFilters));
      if (parsed.success) initialFilters = parsed.data;
    } catch {
      // Ignore malformed dashboard links and show the normal composer.
    }
  }

  const [cappers, recent, savedGroups] = await Promise.all([
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
        sentCount: true,
        openedCount: true,
        bouncedCount: true,
        unsubscribedCount: true,
        failedCount: true,
        status: true,
        scheduledAt: true,
        audienceName: true,
        createdAt: true,
        completedAt: true,
        sentBy: { select: { username: true } },
      },
    }),
    prisma.audienceGroup.findMany({
      where: { createdById: admin.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        filters: true,
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
        icon={Send}
        title="Mass Email"
        subtitle="Build a live capper audience, review every recipient, then send now or schedule through the Brevo queue."
        href="/admin/emails"
        hrefLabel="Edit automated emails"
      />

      <BroadcastComposer
        imageBaseUrl={emailImageBaseUrl()}
        cappers={cappers.map((c) => ({
          id: c.id,
          label: c.username ? `@${c.username}` : c.email,
        }))}
        savedGroups={savedGroups.flatMap((group) => {
          const parsed = audienceFiltersSchema.safeParse(group.filters);
          return parsed.success ? [{ ...group, filters: parsed.data }] : [];
        })}
        initialFilters={initialFilters}
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
                    {(
                      b.audienceName ?? b.audience.replace(/_/g, " ")
                    ).toLowerCase()}{" "}
                    · {b.sentBy?.username ? `@${b.sentBy.username}` : "admin"} ·{" "}
                    {dateTime.format(b.createdAt)}
                  </p>
                  {b.scheduledAt > b.createdAt ? (
                    <p className="text-muted-foreground text-xs">
                      Scheduled for {dateTime.format(b.scheduledAt)}
                    </p>
                  ) : null}
                </div>
                <div className="text-right text-xs tabular-nums">
                  <p className="font-medium">
                    {b.status.replace(/_/g, " ").toLowerCase()} ·{" "}
                    {b.recipientCount} recipients
                  </p>
                  <p className="text-muted-foreground">
                    {b.sentCount} sent · {b.deliveredCount} delivered ·{" "}
                    {b.openedCount} opened
                    {b.bouncedCount ? ` · ${b.bouncedCount} bounced` : ""}
                    {b.unsubscribedCount
                      ? ` · ${b.unsubscribedCount} unsubscribed`
                      : ""}
                    {b.failedCount ? ` · ${b.failedCount} failed` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
