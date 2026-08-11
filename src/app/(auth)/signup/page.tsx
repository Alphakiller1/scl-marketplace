"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm, useWatch, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthHeader, AuthStatusNotice } from "@/components/scl/auth-header";
import { PasswordField } from "@/components/scl/password-field";
import { signupSchema, type SignupInput } from "@/lib/schemas/auth.schema";
import { signupAction } from "@/lib/actions/signup.action";

type Done = { emailDelivered: boolean; verifyUrl?: string };

export default function SignupPage() {
  const [done, setDone] = useState<Done | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      confirmEligibility: false,
      acceptPolicies: false,
      acknowledgeResponsibleGaming: false,
    },
  });
  const consentComplete = useWatch({
    control,
    compute: (values) =>
      Boolean(
        values.confirmEligibility &&
        values.acceptPolicies &&
        values.acknowledgeResponsibleGaming,
      ),
  });

  async function onSubmit(values: SignupInput) {
    try {
      const result = await signupAction(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDone({
        emailDelivered: result.emailDelivered,
        verifyUrl: result.verifyUrl,
      });
    } catch {
      // Never fail silently — a thrown server error must surface to the user.
      toast.error(
        "Something went wrong creating your account. Please try again.",
      );
    }
  }

  if (done) {
    // Email delivered: the standard "check your inbox" confirmation.
    if (done.emailDelivered) {
      return (
        <div className="space-y-5">
          <AuthHeader
            icon={MailCheck}
            eyebrow="Account Created"
            title="Verify your email"
            description="Your SCL identity is reserved. Confirm your email to activate capper access."
          />
          <AuthStatusNotice
            tone="info"
            title="Verification sent"
            description="Check your inbox — the secure link expires in 24 hours."
          />
          <Button
            render={<Link href="/login" />}
            nativeButton={false}
            variant="outline"
            className="min-h-10 w-full"
          >
            Back to log in
          </Button>
        </div>
      );
    }
    // Email couldn't be delivered. With the verify gate off the server hands back a one-tap
    // link so signup stays seamless; with it on there is no bypass, so say plainly that the
    // email failed rather than sending them to watch an inbox nothing arrived in.
    return (
      <div className="space-y-5">
        <AuthHeader
          icon={MailCheck}
          eyebrow="Account Created"
          title={
            done.verifyUrl ? "One tap to finish" : "We couldn't send that email"
          }
          description="Your SCL identity is reserved. Confirm your email to activate capper access."
        />
        {done.verifyUrl ? (
          <Button
            render={<Link href={done.verifyUrl} />}
            nativeButton={false}
            className="min-h-10 w-full"
          >
            Verify &amp; continue
          </Button>
        ) : (
          <AuthStatusNotice
            tone="error"
            title="Verification email failed to send"
            description="Your account is created. Request a new link from the log-in page, and contact SCL support if it still doesn't arrive."
          />
        )}
        <Button
          render={<Link href="/login" />}
          nativeButton={false}
          variant="outline"
          className="min-h-10 w-full"
        >
          Back to log in
        </Button>
      </div>
    );
  }

  return (
    <>
      <AuthHeader
        icon={UserRoundPlus}
        eyebrow="Capper Onboarding"
        title="Create Your Free SCL Profile"
        description="Join 100+ sports cappers building verified records, growing their credibility, and competing on the SCL Leaderboard."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field
          id="username"
          label="SCL Username"
          autoComplete="username"
          register={register("username")}
          error={errors.username?.message}
        />
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          register={register("email")}
          error={errors.email?.message}
        />
        <PasswordField
          id="password"
          label="Password"
          autoComplete="new-password"
          hint="Use at least 12 characters."
          error={errors.password?.message}
          {...register("password")}
        />
        <PasswordField
          id="confirmPassword"
          label="Confirm Password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />

        <div className="border-border bg-surface-2 rounded-xl border p-3 text-xs leading-relaxed">
          <p className="text-muted-foreground">
            Privacy notice at collection: SCL uses account and profile details
            you provide, along with device and activity information collected
            when you use the Platform, to operate, secure, and improve the
            service. Review the{" "}
            <PolicyLink href="/privacy">Privacy Policy</PolicyLink> for the full
            categories, purposes, disclosures, retention practices, and privacy
            rights.
          </p>
        </div>

        <ConsentField
          register={register("confirmEligibility")}
          error={errors.confirmEligibility?.message}
        >
          I confirm that I am at least 18 years old (or the age of legal
          majority in my jurisdiction, if greater), have legal capacity to
          agree, and may lawfully use SCL.
        </ConsentField>

        <ConsentField
          register={register("acceptPolicies")}
          error={errors.acceptPolicies?.message}
        >
          I have read and agree to the{" "}
          <PolicyLink href="/terms">Terms of Service</PolicyLink>, acknowledge
          the <PolicyLink href="/privacy">Privacy Policy</PolicyLink>, and agree
          to the <PolicyLink href="/refund-policy">Refund Policy</PolicyLink>.
        </ConsentField>

        <ConsentField
          register={register("acknowledgeResponsibleGaming")}
          error={errors.acknowledgeResponsibleGaming?.message}
        >
          I have read the{" "}
          <PolicyLink href="/responsible-gaming">
            Responsible Gaming Policy
          </PolicyLink>{" "}
          and understand that wagering involves financial risk and past
          performance does not guarantee future results.
        </ConsentField>

        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting || !consentComplete}
        >
          {isSubmitting ? "Creating account…" : "Start tracking"}
        </Button>
      </form>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Already registered?{" "}
        <Link
          href="/login"
          className="scl-link inline-flex min-h-10 items-center font-medium"
        >
          Log in
        </Link>
      </p>
    </>
  );
}

function Field({
  id,
  label,
  type = "text",
  autoComplete,
  register,
  error,
}: {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
  register: UseFormRegisterReturn;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        className="min-h-10"
        {...register}
      />
      {error ? <p className="text-neg text-xs">{error}</p> : null}
    </div>
  );
}

function ConsentField({
  register,
  error,
  children,
}: {
  register: UseFormRegisterReturn;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="border-border bg-surface-2 flex min-h-12 items-start gap-3 rounded-xl border p-3 text-sm">
        <input
          type="checkbox"
          className="accent-brand mt-0.5 size-5 shrink-0"
          {...register}
        />
        <span className="text-muted-foreground leading-relaxed">
          {children}
        </span>
      </label>
      {error ? <p className="text-neg text-xs">{error}</p> : null}
    </div>
  );
}

function PolicyLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      className="scl-link font-medium"
    >
      {children}
    </Link>
  );
}
