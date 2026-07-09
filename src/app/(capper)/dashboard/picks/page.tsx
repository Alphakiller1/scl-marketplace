import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";

import { getCurrentUser } from "@/lib/session";
import { getCapperPlays } from "@/lib/queries/plays";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/scl/states";
import { SectionHeader } from "@/components/scl/section";
import { PlayListItem } from "@/components/scl/play-list-item";

export const metadata = { title: "My Picks" };

export default async function MyPicksPage() {
  const user = await getCurrentUser();
  const plays = user ? await getCapperPlays(user.id) : [];

  return (
    <div className="space-y-4">
      <SectionHeader
        title="My Picks"
        subtitle={`${plays.length} submitted ${plays.length === 1 ? "position" : "positions"}`}
        href="/dashboard/picks/new"
        hrefLabel="Submit A Play"
      />
      {plays.length ? (
        <div className="space-y-2">
          {plays.map((p) => (
            <PlayListItem key={p.id} play={p} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={ClipboardList}
          title="No Positions Yet"
          description="Your submitted plays and parlays will appear here."
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
