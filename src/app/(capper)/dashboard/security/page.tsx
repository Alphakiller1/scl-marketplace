import { KeyRound, UserX } from "lucide-react";

import { SectionHeader } from "@/components/scl/section";
import { prisma } from "@/lib/prisma";
import { getCurrentAccount } from "@/lib/session";
import { ChangePasswordForm } from "./change-password-form";
import { DeleteAccountForm } from "./delete-account-form";

export const metadata = { title: "Security" };

export default async function SecurityPage() {
  // Layout already ran requireCapperAccess — reuse the cached account.
  const account = await getCurrentAccount();
  if (!account) return null;
  const updateRequired = Boolean(account.passwordUpdateRequiredAt);

  const username = await prisma.user.findUnique({
    where: { id: account.id },
    select: { username: true },
  });
  const handle = username?.username?.replace(/^@/, "") ?? null;

  return (
    <div className="space-y-8">
      <section className="space-y-6">
        <SectionHeader
          icon={KeyRound}
          title="Password"
          subtitle="Change the password you use to sign in to SCL"
        />

        {/* The prompt itself lives in the capper layout, so it follows people
            around the workspace rather than only appearing once they arrive here. */}
        <ChangePasswordForm updateRequired={updateRequired} />
      </section>

      <section className="space-y-6">
        <SectionHeader
          icon={UserX}
          title="Delete account"
          subtitle="Permanently remove your SCL account and all associated data"
        />

        {handle ? (
          <DeleteAccountForm username={handle} />
        ) : (
          <p className="border-border bg-card text-muted-foreground rounded-xl border p-4 text-sm sm:p-5">
            Set a username on your profile before you can delete your account.
          </p>
        )}
      </section>
    </div>
  );
}
