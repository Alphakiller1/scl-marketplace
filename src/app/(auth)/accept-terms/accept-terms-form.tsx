"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { acceptCurrentTermsAction } from "@/lib/actions/legal.action";

type PolicyBundle = {
  id: string;
  termsVersion: string;
  privacyVersion: string;
  responsibleGamingVersion: string;
  refundVersion: string;
};

export function AcceptTermsForm({
  policyBundle,
  destination,
}: {
  policyBundle: PolicyBundle;
  destination: string;
}) {
  const router = useRouter();
  const [confirmEligibility, setConfirmEligibility] = useState(false);
  const [acceptPolicies, setAcceptPolicies] = useState(false);
  const [acknowledgeResponsibleGaming, setAcknowledgeResponsibleGaming] =
    useState(false);
  const [pending, startTransition] = useTransition();
  const allAccepted =
    confirmEligibility && acceptPolicies && acknowledgeResponsibleGaming;

  function submit() {
    startTransition(async () => {
      try {
        const result = await acceptCurrentTermsAction({
          confirmEligibility,
          acceptPolicies,
          acknowledgeResponsibleGaming,
        });

        if (!result.ok) {
          toast.error(result.error);
          return;
        }

        toast.success("Policies accepted");
        router.push(destination);
        router.refresh();
      } catch {
        toast.error("We couldn't save your policy acceptance. Try again.");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="bg-live/15 flex size-11 items-center justify-center rounded-xl text-[color:var(--scl-blue)]">
        <ShieldCheck className="size-5" aria-hidden />
      </div>
      <div>
        <p className="text-muted-foreground text-xs font-semibold uppercase">
          Policy bundle {policyBundle.termsVersion}
        </p>
        <h1 className="mt-1 text-2xl font-bold">Review Account Policies</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          These policies have been updated. Review each linked document —
          acceptance of the current versions is required before continuing to
          your workspace.
        </p>
      </div>

      <div className="space-y-3">
        <ConsentCheckbox
          checked={confirmEligibility}
          onChange={setConfirmEligibility}
        >
          I confirm that I am at least 18 years old (or the age of legal
          majority in my jurisdiction, if greater), have legal capacity to
          agree, and may lawfully use SCL.
        </ConsentCheckbox>
        <ConsentCheckbox checked={acceptPolicies} onChange={setAcceptPolicies}>
          I have read and agree to the{" "}
          {policyLink("/terms", "Terms of Service")}, acknowledge the{" "}
          {policyLink("/privacy", "Privacy Policy")}, and agree to the{" "}
          {policyLink("/refund-policy", "Refund Policy")}.
        </ConsentCheckbox>
        <ConsentCheckbox
          checked={acknowledgeResponsibleGaming}
          onChange={setAcknowledgeResponsibleGaming}
        >
          I have read the{" "}
          {policyLink("/responsible-gaming", "Responsible Gaming Policy")} and
          understand that wagering involves financial risk and past performance
          does not guarantee future results.
        </ConsentCheckbox>
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">
        Recorded versions: Terms {policyBundle.termsVersion}, Privacy{" "}
        {policyBundle.privacyVersion}, Responsible Gaming{" "}
        {policyBundle.responsibleGamingVersion}, Refund{" "}
        {policyBundle.refundVersion}.
      </p>

      <Button
        type="button"
        className="min-h-10 w-full"
        disabled={pending || !allAccepted}
        onClick={submit}
      >
        {pending ? "Saving…" : "Accept and continue"}
      </Button>
    </div>
  );
}

function ConsentCheckbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="border-border bg-surface-2 flex min-h-12 items-start gap-3 rounded-xl border p-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-brand mt-0.5 size-5 shrink-0"
      />
      <span className="text-muted-foreground leading-relaxed">{children}</span>
    </label>
  );
}

function policyLink(href: string, label: string) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      className="scl-link font-medium"
    >
      {label}
    </Link>
  );
}
