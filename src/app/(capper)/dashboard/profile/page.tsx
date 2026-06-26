import { UserCog } from "lucide-react";

import { requireUser } from "@/lib/session";
import { getCapperProfileByUserId } from "@/lib/queries/profile";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/scl/section";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Profile" };

export default async function ProfileSettingsPage() {
  const user = await requireUser();
  const profile = await getCapperProfileByUserId(user.id);

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={UserCog}
        title="Profile"
        subtitle="This is your public capper profile — keep it sharp."
      />

      <Card className="text-muted-foreground flex flex-col gap-1 p-4 text-sm sm:flex-row sm:gap-6">
        <span>
          <span className="text-xs uppercase">Name</span>{" "}
          <span className="text-foreground font-medium">
            {user.name ?? "—"}
          </span>
        </span>
        <span>
          <span className="text-xs uppercase">Email</span>{" "}
          <span className="text-foreground font-medium">{user.email}</span>
        </span>
      </Card>

      {profile ? (
        <ProfileForm profile={profile} />
      ) : (
        <Card className="text-muted-foreground p-6 text-sm">
          No capper profile found for this account.
        </Card>
      )}
    </div>
  );
}
