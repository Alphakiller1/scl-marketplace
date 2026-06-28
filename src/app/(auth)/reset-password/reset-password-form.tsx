"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AuthHeader, AuthStatusNotice } from "@/components/scl/auth-header";
import { PasswordField } from "@/components/scl/password-field";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/schemas/auth.schema";
import { resetPasswordAction } from "@/lib/actions/password-reset.action";

export function ResetPasswordForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
  });

  async function onSubmit(values: ResetPasswordInput) {
    const result = await resetPasswordAction(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <>
        <AuthHeader
          icon={ShieldCheck}
          eyebrow="Password recovery"
          title="Password updated"
          description="Your new credentials are ready for secure SCL access."
        />
        <AuthStatusNotice
          tone="success"
          title="Recovery complete"
          description="The reset link has been consumed and cannot be reused."
        />
        <Button
          render={<Link href="/login" />}
          nativeButton={false}
          className="mt-5 min-h-10 w-full"
        >
          Continue to log in
        </Button>
      </>
    );
  }

  return (
    <>
      <AuthHeader
        icon={KeyRound}
        eyebrow="Password recovery"
        title="Choose a new password"
        description="Set a new credential for your SCL account."
      />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <input type="hidden" {...register("token")} />
        <PasswordField
          id="password"
          label="New password"
          autoComplete="new-password"
          hint="Use at least 12 characters."
          error={errors.password?.message}
          {...register("password")}
        />
        <PasswordField
          id="confirmPassword"
          label="Confirm new password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
        <Button
          type="submit"
          className="min-h-10 w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Updating…" : "Update password"}
        </Button>
      </form>
    </>
  );
}
