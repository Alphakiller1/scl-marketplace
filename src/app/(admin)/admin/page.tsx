import { Gavel, Users } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { StatBlock } from "@/components/scl/stat";
import { SectionHeader } from "@/components/scl/section";

export const metadata = { title: "Admin" };

export default async function AdminOverviewPage() {
  const [cappers, straightPlays, parlays, pendingStraight, pendingParlays] =
    await Promise.all([
      prisma.capperProfile.count(),
      prisma.play.count({ where: { parlayId: null } }),
      prisma.parlay.count(),
      prisma.play.count({ where: { outcome: "PENDING", parlayId: null } }),
      prisma.parlay.count({ where: { outcome: "PENDING" } }),
    ]);
  const positions = straightPlays + parlays;
  const pending = pendingStraight + pendingParlays;

  return (
    <div className="space-y-8">
      <SectionHeader
        icon={Gavel}
        title="Admin Overview"
        subtitle="Operations across the SCL marketplace"
      />
      <Card className="p-4">
        <div className="grid grid-cols-3 gap-4">
          <StatBlock label="Cappers" value={cappers} />
          <StatBlock label="Positions" value={positions} />
          <StatBlock label="Pending grade" value={pending} tone="gold" />
        </div>
      </Card>

      <Card className="text-muted-foreground flex items-start gap-3 p-4 text-sm">
        <Users className="mt-0.5 size-5 shrink-0" />
        <p>
          Admin grading panel, capper management, and package management are the
          next foundation features to land on this shell.
        </p>
      </Card>
    </div>
  );
}
