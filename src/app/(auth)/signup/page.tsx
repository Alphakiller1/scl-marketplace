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

export default function SignupPage() {
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

  async function onSubmit(values: SignupInput) {
    const result = await signupAction(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="space-y-5">
        <AuthHeader
          icon={MailCheck}
          eyebrow="Account created"
          title="Verify your email"
          description="Your SCL identity is reserved. Confirm your email to activate capper access."
        />
        <AuthStatusNotice
          tone="info"
          title="Verification sent"
          description="The secure link expires in 24 hours."
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

  return (
    <>
      <AuthHeader
        icon={UserRoundPlus}
        eyebrow="Capper onboarding"
        title="Create your SCL identity"
        description="Start a secure account and claim the handle attached to your public record."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field
          id="displayName"
          label="Display name"
          autoComplete="name"
          register={register("displayName")}
          error={errors.displayName?.message}
        />
        <Field
          id="username"
          label="SCL handle"
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
          label="Confirm password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />

        <label className="border-border bg-surface-2 flex min-h-12 items-start gap-3 rounded-xl border p-3 text-sm">
          <input
            type="checkbox"
            className="accent-brand mt-0.5 size-4"
            {...register("acceptTerms")}
          />
          <span className="text-muted-foreground">
            I accept the{" "}
            <Link href="/terms" className="text-brand hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-brand hover:underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        {errors.acceptTerms ? (
          <p className="text-neg text-xs">{errors.acceptTerms.message}</p>
        ) : null}

        <Button
          type="submit"
          className="min-h-10 w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating account…" : "Create capper account"}
        </Button>
      </form>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Already registered?{" "}
        <Link href="/login" className="text-brand font-medium hover:underline">
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
