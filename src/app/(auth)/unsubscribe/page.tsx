import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AuthHeader, AuthStatusNotice } from "@/components/scl/auth-header";
import { verifyUnsubscribeToken } from "@/lib/broadcast";
import { applyUnsubscribeAction } from "@/lib/actions/broadcast.action";

export const metadata = { title: "Unsubscribe" };

/**
 * Honours the unsubscribe link on an announcement.
 *
 * No sign-in required — demanding a login to stop receiving mail is the pattern
 * that gets senders reported as spam. The token is HMAC-signed, so it identifies
 * one account and cannot be edited into somebody else's.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const userId = token
    ? verifyUnsubscribeToken(token, process.env.AUTH_SECRET ?? "")
    : null;
  const done = userId ? await applyUnsubscribeAction(userId) : false;

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
