import { UserCog } from "lucide-react";

import { getCurrentUser } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/scl/section";

export const metadata = { title: "Profile" };

export default async function ProfileSettingsPage() {
  const user = await getCurrentUser();
  return (
    <div className="space-y-4">
      <SectionHeader
        icon={UserCog}
        title="Profile"
        subtitle="Your public capper profile"
      />
      <Card className="p-4 text-sm">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground text-xs uppercase">Name</dt>
            <dd className="font-medium">{user?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs uppercase">Email</dt>
            <dd className="font-medium">{user?.email ?? "—"}</dd>
          </div>
        </dl>
        <p className="text-muted-foreground mt-4 text-xs">
          Full profile editing (bio, sports, social handles, packages) arrives
          with the capper-profile feature.
        </p>
      </Card>
    </div>
  );
}
