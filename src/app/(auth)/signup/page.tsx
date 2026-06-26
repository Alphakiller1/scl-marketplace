"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
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
    const res = await signupAction(values);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <Card className="p-6 text-center">
        <span className="bg-live/15 text-live mx-auto mb-4 flex size-12 items-center justify-center rounded-xl">
          <MailCheck className="size-6" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">
          Check your email
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          We sent a verification link to confirm your account. Verify your email
          to start logging plays and building your record.
        </p>
        <Button
          render={<Link href="/login" />}
          variant="outline"
          className="mt-6 w-full"
        >
          Back to log in
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">
          Get ranked as a capper
        </h1>
        <p className="text-muted-foreground text-sm">
          Build a public, verified record.
        </p>
      </div>

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
          label="Username"
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
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          register={register("password")}
          error={errors.password?.message}
        />
        <Field
          id="confirmPassword"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          register={register("confirmPassword")}
          error={errors.confirmPassword?.message}
        />

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-brand mt-0.5 size-4"
            {...register("acceptTerms")}
          />
          <span className="text-muted-foreground">
            I agree to the{" "}
            <Link href="/terms" className="text-brand hover:underline">
              Terms
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

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-brand font-medium hover:underline">
          Log in
        </Link>
      </p>
    </Card>
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
      <Input id={id} type={type} autoComplete={autoComplete} {...register} />
      {error ? <p className="text-neg text-xs">{error}</p> : null}
    </div>
  );
}
