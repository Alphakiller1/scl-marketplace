import Link from "next/link";
import { CheckCircle2, MailWarning, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AuthHeader, AuthStatusNotice } from "@/components/scl/auth-header";
import { consumeVerificationToken } from "@/lib/tokens";

export const metadata = { title: "Verify email" };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <>
        <AuthHeader
          icon={MailWarning}
          eyebrow="Email verification"
          title="Check your inbox"
          description="Open the verification link sent when your SCL account was created."
        />
        <AuthStatusNotice
          tone="info"
          title="Verification required"
          description="Capper play submission unlocks after your email is confirmed."
        />
        <Button
          render={<Link href="/resend-verification" />}
          nativeButton={false}
          variant="outline"
          className="mt-5 min-h-10 w-full"
        >
          Send a new verification link
        </Button>
      </>
    );
  }

  const email = await consumeVerificationToken(token);
  const verified = Boolean(email);

  return (
    <>
      <AuthHeader
        icon={verified ? CheckCircle2 : XCircle}
        eyebrow="Email verification"
        title={verified ? "Account activated" : "Link unavailable"}
        description={
          verified
            ? "Your email is verified and your capper workspace is ready."
            : "This verification link is invalid, expired, or already used."
        }
      />
      <AuthStatusNotice
        tone={verified ? "success" : "error"}
        title={verified ? "Verification complete" : "Verification failed"}
        description={
          verified
            ? "Continue to login, then complete your public identity."
            : "Create a new account or contact SCL support if this continues."
        }
      />
      <Button
        render={
          <Link
            href={
              verified ? "/login?callbackUrl=/dashboard/profile" : "/signup"
            }
          />
        }
        nativeButton={false}
        className="mt-5 min-h-10 w-full"
      >
        {verified ? "Continue to log in" : "Return to signup"}
      </Button>
    </>
  );
}
