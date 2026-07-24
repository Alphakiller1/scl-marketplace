"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthHeader, AuthStatusNotice } from "@/components/scl/auth-header";
import { PasswordField } from "@/components/scl/password-field";
import {
  customerSignupSchema,
  type CustomerSignupInput,
} from "@/lib/schemas/customer.schema";
import { customerSignupAction } from "@/lib/actions/customer-signup.action";

type Done = { emailDelivered: boolean; verifyUrl?: string };

export default function CustomerSignupPage() {
  const [done, setDone] = useState<Done | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomerSignupInput>({
    resolver: zodResolver(customerSignupSchema),
    defaultValues: { marketingOptIn: true, acceptTerms: false },
  });

  async function onSubmit(values: CustomerSignupInput) {
    const result = await customerSignupAction(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setDone({
      emailDelivered: result.emailDelivered,
      verifyUrl: result.verifyUrl,
    });
  }

  if (done) {
    if (done.emailDelivered) {
      return (
        <div className="space-y-5">
          <AuthHeader
            icon={MailCheck}
            eyebrow="Account Created"
            title="Verify Your Email"
            description="Your customer account is reserved. Confirm your email to start browsing packages."
          />
          <AuthStatusNotice
            tone="info"
            title="Verification Sent"
            description="Check your inbox — the secure link expires in 24 hours."
          />
          <Button
            render={<Link href="/login?callbackUrl=/account" />}
            nativeButton={false}
            variant="outline"
            className="min-h-11 w-full"
          >
            Back to log in
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <AuthHeader
          icon={MailCheck}
          eyebrow="Account Created"
          title="You're Ready To Browse"
          description="Your customer account is active. Sign in to view packages and purchase history."
        />
        {done.verifyUrl ? (
          <Button
            render={<Link href={done.verifyUrl} />}
            nativeButton={false}
            className="min-h-11 w-full"
          >
            Verify &amp; continue
          </Button>
        ) : (
          <AuthStatusNotice
            tone="success"
            title="Account ready"
            description="Sign in with your email and password to open your customer dashboard."
          />
        )}
        <Button
          render={<Link href="/login?callbackUrl=/account" />}
          nativeButton={false}
          variant="outline"
          className="min-h-11 w-full"
        >
          Go to log in
        </Button>
      </div>
    );
  }

  return (
    <>
      <AuthHeader
        icon={ShoppingBag}
        eyebrow="Customer Account"
        title="Join SCL Marketplace"
        description="Create a customer account to follow packages and keep purchase history in one place."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="displayName">Name (optional)</Label>
          <Input
            id="displayName"
            className="min-h-11"
            {...register("displayName")}
          />
          {errors.displayName ? (
            <p className="text-neg text-xs">{errors.displayName.message}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            className="min-h-11"
            {...register("email")}
          />
          {errors.email ? (
            <p className="text-neg text-xs">{errors.email.message}</p>
          ) : null}
        </div>
        <PasswordField
          id="password"
          label="Password"
          autoComplete="new-password"
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
            {...register("marketingOptIn")}
          />
          <span className="text-muted-foreground">
            Send me marketplace updates and package announcements.
          </span>
        </label>
        <label className="border-border bg-surface-2 flex min-h-12 items-start gap-3 rounded-xl border p-3 text-sm">
          <input
            type="checkbox"
            className="accent-brand mt-0.5 size-4"
            {...register("acceptTerms")}
          />
          <span className="text-muted-foreground">
            I accept the{" "}
            <Link
              href="/terms"
              className="text-brand font-medium hover:underline"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="text-brand font-medium hover:underline"
            >
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
          className="min-h-11 w-full"
          disabled={isSubmitting}
        >
          Create customer account
        </Button>
      </form>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Capper?{" "}
        <Link href="/signup" className="text-brand font-medium hover:underline">
          Create a capper account
        </Link>
      </p>
    </>
  );
}
