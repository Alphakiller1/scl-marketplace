import Link from "next/link";
import { after } from "next/server";
import { CheckCircle2, MailWarning } from "lucide-react";

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

  // `consumeVerificationToken` DELETES the token and answers only the caller
  // that deleted it, so the overwhelmingly common way to land here without a
  // claim is opening a link that already worked — a second tap, the reminder
  // mail's copy of it, or the same link on a second device. Telling that person
  // "Verification failed" and offering "Return to signup" is wrong twice over:
  // their account is verified and active, and the advice invites a duplicate
  // account. A verified capper reported exactly this and believed he was
  // locked out.
  //
  // The three unclaimed cases — already used, expired, never valid — are not
  // distinguishable here once the row is gone, so the copy covers all three
  // honestly and routes to the two actions that can help: log in, or get a
  // fresh link. Neither is destructive if the guess is wrong.
  return (
    <>
      <AuthHeader
        icon={verified ? CheckCircle2 : MailWarning}
        eyebrow="Email Verification"
        title={verified ? "Account activated" : "This link is no longer active"}
        description={
          verified
            ? "Your email is verified and your capper workspace is ready."
            : "Verification links work once. If you have already used this one, your account is verified and you can simply log in."
        }
      />
      <AuthStatusNotice
        tone={verified ? "success" : "info"}
        title={verified ? "Verification complete" : "Already verified?"}
        description={
          verified
            ? "Continue to login, then complete your public identity."
            : "Log in below. If the link expired before you opened it, send yourself a new one."
        }
      />
      <Button
        render={<Link href="/login?callbackUrl=/dashboard/profile" />}
        nativeButton={false}
        className="mt-5 min-h-10 w-full"
      >
        {verified ? "Continue to log in" : "Log in"}
      </Button>
      {verified ? null : (
        <Button
          render={<Link href="/resend-verification" />}
          nativeButton={false}
          variant="outline"
          className="mt-2 min-h-10 w-full"
        >
          Send a new verification link
        </Button>
      )}
    </>
  );
}
