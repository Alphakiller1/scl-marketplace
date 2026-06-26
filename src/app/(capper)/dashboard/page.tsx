import { ClipboardList, MailWarning } from "lucide-react";

import { getCurrentUser } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { StatBlock } from "@/components/scl/stat";
import { EmptyState } from "@/components/scl/states";
import { SectionHeader } from "@/components/scl/section";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const verified = Boolean(user?.emailVerified);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome{user?.name ? `, ${user.name}` : ""}
        </h1>
        <p className="text-muted-foreground text-sm">
          Your record builds as you log plays and they&apos;re graded.
        </p>
      </div>

      {!verified ? (
        <Card className="border-gold/30 bg-gold/10 flex items-start gap-3 p-4">
          <MailWarning className="text-gold mt-0.5 size-5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">
              Verify your email to start logging plays
            </p>
            <p className="text-muted-foreground">
              We sent a verification link when you signed up. Gated capper
              actions unlock once your email is confirmed.
            </p>
          </div>
        </Card>
      ) : null}

      <Card className="p-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatBlock label="Record" value="0-0-0" />
          <StatBlock label="Win %" value="—" />
          <StatBlock label="Units" value="0" />
          <StatBlock label="ROI" value="—" />
        </div>
      </Card>

      <section className="space-y-4">
        <SectionHeader icon={ClipboardList} title="Recent plays" />
        <EmptyState
          icon={ClipboardList}
          title="No plays yet"
          description="Submit your first play to start building a verified record. Manual play entry arrives next."
        />
      </section>
    </div>
  );
}
