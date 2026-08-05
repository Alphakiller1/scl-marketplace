"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle } from "lucide-react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";

import { PasswordField } from "@/components/scl/password-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteOwnAccountAction } from "@/lib/actions/account-delete.action";
import {
  deleteOwnAccountSchema,
  type DeleteOwnAccountInput,
} from "@/lib/schemas/account-delete.schema";

export function DeleteAccountForm({ username }: { username: string }) {
  const [confirmed, setConfirmed] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DeleteOwnAccountInput>({
    resolver: zodResolver(deleteOwnAccountSchema),
    defaultValues: { username: "", password: "" },
  });

  async function onSubmit(values: DeleteOwnAccountInput) {
    if (!confirmed) {
      toast.error("Confirm that you understand this action is permanent.");
      return;
    }

    try {
      const result = await deleteOwnAccountAction(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Your account has been deleted.");
      await signOut({ callbackUrl: "/" });
    } catch {
      toast.error("We couldn't delete your account. Try again.");
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="border-neg/30 bg-card space-y-4 rounded-xl border p-4 sm:p-5"
      noValidate
    >
      <div className="border-neg/20 bg-neg/5 flex items-start gap-2 rounded-lg border p-3 text-sm">
        <AlertTriangle
          className="text-neg mt-0.5 size-4 shrink-0"
          aria-hidden
        />
        <p className="text-muted-foreground">
          Deleting your account permanently removes your profile, plays,
          packages, and storefront data. This cannot be undone.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="delete-username">Username</Label>
        <Input
          id="delete-username"
          autoComplete="username"
          placeholder={`@${username}`}
          className="min-h-10"
          aria-invalid={Boolean(errors.username)}
          {...register("username")}
        />
        <p className="text-muted-foreground text-xs">
          Type <span className="font-semibold">@{username}</span> to confirm.
        </p>
        {errors.username ? (
          <p className="text-neg text-xs">{errors.username.message}</p>
        ) : null}
      </div>

      <PasswordField
        id="delete-password"
        label="Password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="border-input mt-1 size-4 rounded border"
        />
        <span>
          I understand this permanently deletes my SCL account and all
          associated data.
        </span>
      </label>

      <Button
        type="submit"
        variant="destructive"
        className="min-h-10 w-full sm:w-auto"
        disabled={isSubmitting || !confirmed}
      >
        {isSubmitting ? "Deleting…" : "Delete my account"}
      </Button>
    </form>
  );
}
