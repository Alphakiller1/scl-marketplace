import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";

import { getCurrentUser } from "@/lib/session";
import {
  getCapperParlays,
  getCapperPlays,
  mergeRecordEntries,
} from "@/lib/queries/plays";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/scl/states";
import { SectionHeader } from "@/components/scl/section";
import { ParlayListItem, PlayListItem } from "@/components/scl/play-list-item";

export const metadata = { title: "My Picks" };

export default async function MyPicksPage() {
  const user = await getCurrentUser();
  const [plays, parlays] = user
    ? await Promise.all([getCapperPlays(user.id), getCapperParlays(user.id)])
    : [[], []];
  const entries = mergeRecordEntries(plays, parlays);

  return (
    <div className="space-y-4">
      <SectionHeader
        title="My Picks"
        subtitle={
          entries.length
            ? `${entries.length} submitted ${entries.length === 1 ? "Ticket" : "Tickets"} — pending until graded`
            : "Your public record is built from board-checked Tickets"
        }
        href="/dashboard/picks/new"
        hrefLabel="New Pick"
      />
      {entries.length ? (
        <div className="space-y-2">
          {entries.map((e) =>
            e.kind === "parlay" ? (
              <ParlayListItem key={`parlay-${e.id}`} parlay={e} />
            ) : (
              <PlayListItem key={`play-${e.id}`} play={e} dashboard />
            ),
          )}
        </div>
      ) : (
        <EmptyState
          icon={ClipboardList}
          title="No Plays Yet"
          description="Submit a board-checked play to start an inspectable record. Nothing appears here until you log a Ticket."
          action={
            <Button
              render={<Link href="/dashboard/picks/new" />}
              nativeButton={false}
              className="min-h-11 gap-1.5"
            >
              <Plus className="size-4" aria-hidden /> New Pick
            </Button>
          }
        />
      )}
    </div>
  );
}
