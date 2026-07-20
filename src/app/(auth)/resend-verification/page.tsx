"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthHeader, AuthStatusNotice } from "@/components/scl/auth-header";
import {
  verificationRequestSchema,
  type VerificationRequestInput,
} from "@/lib/schemas/auth.schema";
import { resendVerificationAction } from "@/lib/actions/verification.action";

export default function ResendVerificationPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerificationRequestInput>({
    resolver: zodResolver(verificationRequestSchema),
  });

  async function onSubmit(values: VerificationRequestInput) {
    const result = await resendVerificationAction(values);
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
          eyebrow="Email Verification"
          title="Check your inbox"
          description="If an eligible pending account matches that address, a new link is on the way."
        />
        <AuthStatusNotice
          tone="info"
          title="Request received"
          description="For security, verification emails are limited to one per minute."
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
        icon={Send}
        eyebrow="Email Verification"
        title="Send a new verification link"
        description="Request a fresh single-use link for a pending SCL account."
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
          {isSubmitting ? "Requesting…" : "Send verification link"}
        </Button>
      </form>
    </>
  );
}
