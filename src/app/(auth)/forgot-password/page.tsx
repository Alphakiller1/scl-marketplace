"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthHeader, AuthStatusNotice } from "@/components/scl/auth-header";
import {
  passwordResetRequestSchema,
  type PasswordResetRequestInput,
} from "@/lib/schemas/auth.schema";
import { requestPasswordResetAction } from "@/lib/actions/password-reset.action";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordResetRequestInput>({
    resolver: zodResolver(passwordResetRequestSchema),
  });

  async function onSubmit(values: PasswordResetRequestInput) {
    const result = await requestPasswordResetAction(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <>
        <AuthHeader
          icon={MailCheck}
          eyebrow="Password Recovery"
          title="Check Your Email"
          description="If an eligible SCL account matches that address, a secure reset link is on the way."
        />
        <AuthStatusNotice
          tone="info"
          title="Request Received"
          description="The link expires in one hour and can be used once."
        />
        <Button
          render={<Link href="/login" />}
          nativeButton={false}
          variant="outline"
          className="mt-5 min-h-10 w-full"
        >
          Return to log in
        </Button>
      </>
    );
  }

  return (
    <>
      <AuthHeader
        icon={KeyRound}
        eyebrow="Password Recovery"
        title="Recover Account Access"
        description="Request a single-use reset link for your SCL account."
      />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            className="min-h-10"
            {...register("email")}
          />
          {errors.email ? (
            <p className="text-neg text-xs">{errors.email.message}</p>
          ) : null}
        </div>
        <Button
          type="submit"
          className="min-h-10 w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Requesting…" : "Send secure reset link"}
        </Button>
      </form>
      <p className="text-muted-foreground mt-6 text-center text-sm">
        Remembered it?{" "}
        <Link href="/login" className="text-brand font-medium hover:underline">
          Return to login
        </Link>
      </p>
    </>
  );
}
