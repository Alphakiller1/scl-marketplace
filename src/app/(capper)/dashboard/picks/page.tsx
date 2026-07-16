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
        subtitle={`${entries.length} submitted ${entries.length === 1 ? "pick" : "picks"}`}
        href="/dashboard/picks/new"
        hrefLabel="Submit A Play"
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
          description="Your submitted plays will appear here."
          action={
            <Button
              render={<Link href="/dashboard/picks/new" />}
              nativeButton={false}
              className="gap-1.5"
            >
              <Plus className="size-4" /> Submit A Play
            </Button>
          }
        />
      )}
    </div>
  );
}
