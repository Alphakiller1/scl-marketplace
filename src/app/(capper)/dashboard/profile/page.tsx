import Link from "next/link";
import { KeyRound, UserCog } from "lucide-react";

import { getCurrentUser } from "@/lib/session";
import { getCapperProfileByUserId } from "@/lib/queries/profile";
import { SectionHeader } from "@/components/scl/section";
import { Button } from "@/components/ui/button";
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

      <div className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Password</p>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Change the password you use to sign in.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="min-h-10 shrink-0"
          render={<Link href="/dashboard/security" />}
          nativeButton={false}
        >
          <KeyRound className="size-4" aria-hidden />
          Manage password
        </Button>
      </div>

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
