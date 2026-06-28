import Link from "next/link";
import { KeyRound } from "lucide-react";

import { ResetPasswordForm } from "./reset-password-form";
import { Button } from "@/components/ui/button";
import { AuthHeader, AuthStatusNotice } from "@/components/scl/auth-header";

export const metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <>
        <AuthHeader
          icon={KeyRound}
          eyebrow="Password recovery"
          title="Reset link required"
          description="Request a new secure link to update your password."
        />
        <AuthStatusNotice
          tone="error"
          title="No reset token found"
          description="The recovery URL is incomplete or no longer available."
        />
        <Button
          render={<Link href="/forgot-password" />}
          nativeButton={false}
          className="mt-5 min-h-10 w-full"
        >
          Request a reset link
        </Button>
      </>
    );
  }

  return <ResetPasswordForm token={token} />;
}
