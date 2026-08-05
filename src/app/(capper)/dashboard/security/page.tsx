import { KeyRound } from "lucide-react";

import { SectionHeader } from "@/components/scl/section";
import { getCurrentAccount } from "@/lib/session";
import { ChangePasswordForm } from "./change-password-form";

export const metadata = { title: "Security" };

export default async function SecurityPage() {
  // Layout already ran requireCapperAccess — reuse the cached account.
  const account = await getCurrentAccount();
  if (!account) return null;
  const updateRequired = Boolean(account.passwordUpdateRequiredAt);

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={KeyRound}
        title="Password"
        subtitle="Change the password you use to sign in to SCL"
      />

      {/* The prompt itself lives in the capper layout, so it follows people
          around the workspace rather than only appearing once they arrive here. */}
      <ChangePasswordForm updateRequired={updateRequired} />
    </div>
  );
}
