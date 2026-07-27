"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { acceptCurrentTermsAction } from "@/lib/actions/legal.action";

export function AcceptTermsForm({ policyVersion }: { policyVersion: string }) {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    const result = await acceptCurrentTermsAction({ acceptTerms: accepted });
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Policies accepted");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="bg-live/15 flex size-11 items-center justify-center rounded-xl text-[color:var(--scl-blue)]">
        <ShieldCheck className="size-5" aria-hidden />
      </div>
      <div>
        <p className="text-muted-foreground text-xs font-semibold uppercase">
          Policy version {policyVersion}
        </p>
        <h1 className="mt-1 text-2xl font-bold">Review Account Policies</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Current policy acceptance is required before accessing capper tools.
        </p>
      </div>

      <label className="border-border bg-surface-2 flex min-h-12 items-start gap-3 rounded-xl border p-3 text-sm">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          className="accent-brand mt-0.5 size-4"
        />
        <span className="text-muted-foreground">
          I accept the{" "}
          <Link href="/terms" className="scl-link font-medium">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="scl-link font-medium">
            Privacy Policy
          </Link>
          .
        </span>
      </label>

      <Button
        type="button"
        className="min-h-10 w-full"
        disabled={pending}
        onClick={() => void submit()}
      >
        {pending ? "Saving…" : "Accept and continue"}
      </Button>
    </div>
  );
}
