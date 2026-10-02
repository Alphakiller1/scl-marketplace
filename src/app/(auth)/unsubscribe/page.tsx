import Link from "next/link";
import { CheckCircle2, MailX, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AuthHeader, AuthStatusNotice } from "@/components/scl/auth-header";
import { confirmUnsubscribeAction } from "@/lib/actions/unsubscribe.action";
import { prisma } from "@/lib/prisma";
import { unsubscribeTokenUserId } from "@/lib/unsubscribe";

export const metadata = { title: "Unsubscribe" };

/**
 * Honours the unsubscribe link on an announcement.
 *
 * No sign-in required — demanding a login to stop receiving mail is the pattern
 * that gets senders reported as spam. The token is HMAC-signed, so it identifies
 * one account and cannot be edited into somebody else's.
 *
 * Loading the page changes nothing: link scanners pre-fetch every URL in a
 * message, so the opt-out happens on the confirm button's POST instead.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; result?: string }>;
}) {
  const { token, result } = await searchParams;
  const userId = unsubscribeTokenUserId(token);
  const account = userId
    ? await prisma.user
        .findUnique({
          where: { id: userId },
          select: { marketingOptOut: true },
        })
        .catch(() => null)
    : null;

  const state: "invalid" | "confirm" | "done" =
    !userId || !account || result === "failed"
      ? "invalid"
      : account.marketingOptOut
        ? "done"
        : "confirm";

  if (state === "confirm") {
    return (
      <>
        <AuthHeader
          icon={MailX}
          eyebrow="Email preferences"
          title="Stop SCL announcements?"
          description="You will stop receiving announcement and campaign email from SCL."
        />
        <form action={confirmUnsubscribeAction} className="mt-5 space-y-3">
          <input type="hidden" name="token" value={token ?? ""} />
          <Button type="submit" className="min-h-10 w-full">
            Unsubscribe
          </Button>
          <Button
            render={<Link href="/" />}
            nativeButton={false}
            variant="outline"
            className="min-h-10 w-full"
          >
            Keep receiving announcements
          </Button>
        </form>
      </>
    );
  }

  const done = state === "done";
  return (
    <>
      <AuthHeader
        icon={done ? CheckCircle2 : XCircle}
        eyebrow="Email preferences"
        title={done ? "Unsubscribed" : "Link not recognised"}
        description={
          done
            ? "You will not receive SCL announcements again."
            : "That unsubscribe link is invalid or has already been replaced."
        }
      />
      <AuthStatusNotice
        tone={done ? "success" : "error"}
        title={done ? "Announcements turned off" : "Nothing changed"}
        description={
          done
            ? "Account and security email — verification, password resets, and messages about your own account — still reaches you. Those are not marketing and cannot be turned off."
            : "Contact SCL support and we will turn announcements off for you."
        }
      />
      <Button
        render={<Link href="/" />}
        nativeButton={false}
        variant="outline"
        className="mt-5 min-h-10 w-full"
      >
        Back to SCL
      </Button>
    </>
  );
}
