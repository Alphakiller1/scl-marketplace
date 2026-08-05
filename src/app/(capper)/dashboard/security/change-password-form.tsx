"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/scl/password-field";
import {
  changePasswordSchema,
  type ChangePasswordInput,
} from "@/lib/schemas/auth.schema";
import { changePasswordAction } from "@/lib/actions/password.action";
import { PASSWORD_POLICY_SUMMARY } from "@/lib/password-policy";

export function ChangePasswordForm({
  updateRequired,
}: {
  updateRequired: boolean;
}) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(values: ChangePasswordInput) {
    try {
      const result = await changePasswordAction(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      reset();
      setDone(true);
      toast.success("Password updated");
      router.refresh();
    } catch {
      toast.error("We couldn't update your password. Try again.");
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="border-border bg-card space-y-4 rounded-xl border p-4 sm:p-5"
      noValidate
    >
      {done ? (
        <p className="border-border bg-surface-2 text-muted-foreground flex items-start gap-2 rounded-lg border p-3 text-sm">
          <ShieldCheck
            className="text-pos mt-0.5 size-4 shrink-0"
            aria-hidden
          />
          Your password is updated. Use it the next time you sign in.
        </p>
      ) : null}

      <PasswordField
        id="currentPassword"
        label="Current password"
        autoComplete="current-password"
        hint={
          updateRequired
            ? "The password you signed in with, including the one from your previous SCL account."
            : undefined
        }
        error={errors.currentPassword?.message}
        {...register("currentPassword")}
      />
      <PasswordField
        id="password"
        label="New password"
        autoComplete="new-password"
        hint={`Use ${PASSWORD_POLICY_SUMMARY}.`}
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
        className="min-h-10 w-full sm:w-auto"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
