import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { consumeVerificationToken } from "@/lib/tokens";

export const metadata = { title: "Verify email" };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const email = token ? await consumeVerificationToken(token) : null;
  const ok = Boolean(email);

  return (
    <Card className="p-6 text-center">
      <span
        className={`mx-auto mb-4 flex size-12 items-center justify-center rounded-xl ${
          ok ? "bg-pos/15 text-pos" : "bg-neg/15 text-neg"
        }`}
      >
        {ok ? (
          <CheckCircle2 className="size-6" />
        ) : (
          <XCircle className="size-6" />
        )}
      </span>
      <h1 className="text-xl font-semibold tracking-tight">
        {ok ? "Email verified" : "Verification failed"}
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        {ok
          ? "Your email is confirmed. You can now log in and start logging plays."
          : "This verification link is invalid or has expired. Try signing up again or request a new link."}
      </p>
      <Button render={<Link href="/login" />} className="mt-6 w-full">
        Continue to log in
      </Button>
    </Card>
  );
}
