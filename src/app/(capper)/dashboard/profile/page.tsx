import { UserCog } from "lucide-react";

import { getCurrentUser } from "@/lib/session";
import { getCapperProfileByUserId } from "@/lib/queries/profile";
import { SectionHeader } from "@/components/scl/section";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Profile" };

export default async function ProfileSettingsPage() {
  // Layout already ran requireCapperAccess — reuse cached session user.
  const user = await getCurrentUser();
  if (!user) return null;
  const profile = await getCapperProfileByUserId(user.id);

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={UserCog}
        title="Capper Identity"
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
