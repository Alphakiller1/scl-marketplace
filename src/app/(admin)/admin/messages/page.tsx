import { Send } from "lucide-react";

import { CancelBroadcastButton } from "@/components/scl/cancel-broadcast-button";

import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/scl/section";
import { BroadcastComposer } from "@/components/scl/broadcast-composer";
import { requireAdmin } from "@/lib/session";
import { emailImageBaseUrl } from "@/lib/email-image-url";
import { formatAdminBroadcastDate } from "@/lib/admin-broadcast-date";
import {
  audienceFiltersSchema,
  parseAudienceFiltersParam,
} from "@/lib/schemas/audience.schema";

export const metadata = { title: "Mass email" };
export const maxDuration = 300;

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ filters?: string }>;
}) {
  const admin = await requireAdmin();
  // A malformed dashboard link falls back to the normal composer.
  const initialFilters =
    parseAudienceFiltersParam((await searchParams).filters) ?? undefined;

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
      take: 20,
      select: {
        id: true,
        subject: true,
        body: true,
        provider: true,
        queuedCount: true,
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
          Email history
        </h2>
        {recent.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">
            Nothing sent yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {recent.map((b) => {
              const legacy = b.provider !== "BREVO";
              const open = b.status === "QUEUED" || b.status === "PROCESSING";
              const scheduled =
                b.scheduledAt.getTime() - b.createdAt.getTime() > 60_000;
              return (
                <li
                  key={b.id}
                  className="border-border space-y-2 border-b pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {b.subject}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {(
                          b.audienceName ?? b.audience.replace(/_/g, " ")
                        ).toLowerCase()}{" "}
                        ·{" "}
                        {b.sentBy?.username ? `@${b.sentBy.username}` : "admin"}{" "}
                        · created {formatAdminBroadcastDate(b.createdAt)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {scheduled
                          ? `${open ? "Scheduled for" : "Scheduled"} ${formatAdminBroadcastDate(b.scheduledAt)}`
                          : null}
                        {b.completedAt
                          ? `${scheduled ? " · " : ""}${b.status === "CANCELLED" ? "Cancelled" : "Finished"} ${formatAdminBroadcastDate(b.completedAt)}`
                          : null}
                      </p>
                    </div>
                    <div className="text-right text-xs tabular-nums">
                      <p className="font-medium">
                        {b.status.replace(/_/g, " ").toLowerCase()} ·{" "}
                        {b.recipientCount} recipients
                      </p>
                      <p className="text-muted-foreground">
                        {legacy
                          ? `${b.sentCount} sent via Resend${b.failedCount ? ` · ${b.failedCount} failed` : ""}`
                          : [
                              `${b.queuedCount} queued`,
                              `${b.sentCount} sent`,
                              `${b.deliveredCount} delivered`,
                              `${b.openedCount} opened`,
                              `${b.bouncedCount} bounced`,
                              `${b.unsubscribedCount} unsubscribed`,
                              ...(b.failedCount
                                ? [`${b.failedCount} failed`]
                                : []),
                            ].join(" · ")}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <details className="min-w-0 flex-1 text-xs">
                      <summary className="text-muted-foreground hover:text-foreground cursor-pointer">
                        View message
                      </summary>
                      <p className="bg-surface-2 mt-2 max-h-64 overflow-y-auto rounded-lg p-3 whitespace-pre-wrap">
                        {b.body}
                      </p>
                    </details>
                    {open && !legacy ? (
                      <CancelBroadcastButton
                        broadcastId={b.id}
                        subject={b.subject}
                      />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
