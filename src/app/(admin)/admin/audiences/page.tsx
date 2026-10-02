import Link from "next/link";
import { Send, Users } from "lucide-react";

import { AudienceExplorer } from "@/components/scl/audience-explorer";
import { SectionHeader } from "@/components/scl/section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  INELIGIBLE_REASON_LABEL,
  audienceLabel,
  audienceMessagesHref,
} from "@/lib/admin-audience";
import { audienceCounts } from "@/lib/admin-audience-members";
import { prisma } from "@/lib/prisma";
import { listAudienceMembers } from "@/lib/queries/admin-audience";
import {
  audienceFiltersSchema,
  emptyAudienceFilters,
  parseAudienceFiltersParam,
} from "@/lib/schemas/audience.schema";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Capper audiences" };

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function AdminAudiencesPage({
  searchParams,
}: {
  searchParams: Promise<{ filters?: string }>;
}) {
  const admin = await requireAdmin();
  const filters =
    parseAudienceFiltersParam((await searchParams).filters) ??
    emptyAudienceFilters();

  const [members, groups] = await Promise.all([
    listAudienceMembers(filters),
    prisma.audienceGroup.findMany({
      where: { createdById: admin.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, filters: true },
    }),
  ]);
  const savedGroups = groups.flatMap((group) => {
    const parsed = audienceFiltersSchema.safeParse(group.filters);
    return parsed.success ? [{ ...group, filters: parsed.data }] : [];
  });
  const { total, emailable } = audienceCounts(members);

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Users}
        title="Capper audiences"
        subtitle="The exact cappers behind every dashboard number. Combine filters, review the accounts, then email the same group."
      />

      <Card className="space-y-4 p-4">
        <AudienceExplorer filters={filters} savedGroups={savedGroups} />
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold">{audienceLabel(filters)}</h2>
            <p className="text-muted-foreground text-sm" role="status">
              <span className="text-foreground font-semibold tabular-nums">
                {total}
              </span>{" "}
              capper{total === 1 ? "" : "s"} ·{" "}
              <span className="text-foreground font-semibold tabular-nums">
                {emailable}
              </span>{" "}
              emailable
            </p>
          </div>
          {emailable > 0 ? (
            <Button
              render={<Link href={audienceMessagesHref(filters)} />}
              nativeButton={false}
              className="min-h-10"
            >
              <Send className="size-4" aria-hidden /> Email these {emailable}
            </Button>
          ) : null}
        </div>

        {members.length === 0 ? (
          <p className="text-muted-foreground mt-8 mb-4 text-center text-sm">
            No cappers match these filters.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <caption className="sr-only">
                Cappers matching {audienceLabel(filters)}
              </caption>
              <thead className="text-muted-foreground border-border border-b text-xs uppercase">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Capper
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Joined
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Account
                  </th>
                  <th
                    scope="col"
                    className="py-2 pr-3 text-right font-semibold"
                  >
                    Plays
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Last play
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Storefront
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    Email
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-border border-b">
                    <td className="max-w-56 py-2 pr-3">
                      {member.username ? (
                        <Link
                          href={`/admin/cappers?search=${encodeURIComponent(member.username)}`}
                          className="font-medium hover:underline"
                        >
                          @{member.username}
                        </Link>
                      ) : (
                        <span className="font-medium">
                          {member.displayName ?? "No handle"}
                        </span>
                      )}
                      <span className="text-muted-foreground block truncate text-xs">
                        {member.email}
                      </span>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap tabular-nums">
                      {dateFormat.format(member.createdAt)}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {member.accountStatus.toLowerCase()}
                      {member.emailVerified ? " · verified" : " · unverified"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {member.playCount + member.parlayCount}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap tabular-nums">
                      {member.lastPlayAt
                        ? dateFormat.format(member.lastPlayAt)
                        : "Never"}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {member.hasConnectedStorefront
                        ? "Connected"
                        : "Not connected"}
                      {member.storefrontAwaitingReview
                        ? " · awaiting review"
                        : ""}
                    </td>
                    <td className="py-2 text-xs">
                      {member.eligible ? (
                        "Emailable"
                      ) : (
                        <span className="text-muted-foreground">
                          {member.ineligibleReason
                            ? INELIGIBLE_REASON_LABEL[member.ineligibleReason]
                            : "Not emailable"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
