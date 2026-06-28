import { UserCog } from "lucide-react";

import { requireCapperAccess } from "@/lib/session";
import { getCapperProfileByUserId } from "@/lib/queries/profile";
import { SectionHeader } from "@/components/scl/section";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Profile" };

export default async function ProfileSettingsPage() {
  const user = await requireCapperAccess();
  const profile = await getCapperProfileByUserId(user.id);

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={UserCog}
        title="Capper identity"
        subtitle="Shape how your record appears across SCL"
      />

      {profile ? (
        <ProfileForm profile={profile} />
      ) : (
        <div className="border-border bg-card text-muted-foreground rounded-xl border p-6 text-sm">
          No capper profile found for this account.
        </div>
      )}
    </div>
  );
}
