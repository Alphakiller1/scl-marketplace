"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
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
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

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
    // Email couldn't be delivered: keep signup seamless with a one-tap verify instead of
    // stranding the user waiting on an email that won't arrive.
    return (
      <div className="space-y-5">
        <AuthHeader
          icon={MailCheck}
          eyebrow="Account Created"
          title="One tap to finish"
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
            tone="info"
            title="Almost there"
            description="Use the resend option from the log-in page to get your verification link."
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
        title="Create your SCL Profile"
        description="Start a secure account and claim the username attached to your public record."
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

        <label className="border-border bg-surface-2 flex min-h-12 items-start gap-3 rounded-xl border p-3 text-sm">
          <input
            type="checkbox"
            className="accent-brand mt-0.5 size-5"
            {...register("acceptTerms")}
          />
          <span className="text-muted-foreground">
            I accept the{" "}
            <Link
              href="/terms"
              className="scl-link inline-flex min-h-10 items-center align-middle"
            >
              Terms Of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="scl-link inline-flex min-h-10 items-center align-middle"
            >
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        {errors.acceptTerms ? (
          <p className="text-neg text-xs">{errors.acceptTerms.message}</p>
        ) : null}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
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
