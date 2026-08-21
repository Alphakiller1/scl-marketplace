import Link from "next/link";
import { after } from "next/server";
import { CheckCircle2, MailWarning, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AuthHeader, AuthStatusNotice } from "@/components/scl/auth-header";
import { consumeVerificationToken } from "@/lib/tokens";
import { appUrl } from "@/lib/app-url";
import { signUnsubscribeToken } from "@/lib/broadcast";
import { sendWelcomeEmail } from "@/lib/email";

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
          eyebrow="Email Verification"
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

  const claimed = await consumeVerificationToken(token);
  const verified = Boolean(claimed);

  // Welcome the capper here rather than at signup, because here is where the
  // account starts working. With REQUIRE_EMAIL_VERIFICATION on, a fresh signup
  // is PENDING and every capper route bounces it back to /verify — so a welcome
  // sent at signup would put "log in and start tracking your plays" in front of
  // someone the app refuses to let in, competing with the verification mail that
  // actually unblocks them.
  //
  // `consumeVerificationToken` only returns a result to the caller that deleted
  // the token, so re-opening the link cannot send a second copy.
  if (claimed && !claimed.marketingOptOut) {
    const secret = process.env.AUTH_SECRET ?? "";
    after(async () => {
      await sendWelcomeEmail({
        email: claimed.email,
        unsubscribeUrl: secret
          ? `${appUrl()}/unsubscribe?token=${signUnsubscribeToken(claimed.userId, secret)}`
          : undefined,
      });
    });
  }

  return (
    <>
      <AuthHeader
        icon={verified ? CheckCircle2 : XCircle}
        eyebrow="Email Verification"
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
