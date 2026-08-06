"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn } from "lucide-react";
import { getSession, signIn } from "next-auth/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthFormSkeleton, AuthHeader } from "@/components/scl/auth-header";
import { PasswordField } from "@/components/scl/password-field";
import { getDefaultWorkspace, getSafeCallbackPath } from "@/lib/auth-routing";
import { loginSchema, type LoginInput } from "@/lib/schemas/auth.schema";

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = getSafeCallbackPath(params.get("callbackUrl"));

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    try {
      const result = await Promise.race([
        signIn("credentials", {
          ...values,
          redirect: false,
        }),
        new Promise<null>((resolve) => {
          window.setTimeout(() => resolve(null), 15_000);
        }),
      ]);
      if (!result) {
        toast.error(
          "Sign-in is taking too long. Check your connection and try again.",
        );
        return;
      }
      if (result.error) {
        toast.error("Unable to sign in with those credentials");
        return;
      }

      let destination = callbackUrl;
      if (!destination) {
        const session = await getSession();
        destination = getDefaultWorkspace(session?.user?.role).href;
      }

      toast.success("Welcome back");
      router.replace(destination);
      router.refresh();
    } catch {
      toast.error("Couldn't sign you in. Please try again in a moment.");
    }
  }

  return (
    <>
      <AuthHeader
        icon={LogIn}
        eyebrow="Account Access"
        title="Welcome back"
        description="Sign in with your username, email, and password. If you manage multiple SCL accounts on one inbox, use the username for the profile you want."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            type="text"
            autoComplete="username"
            spellCheck={false}
            className="min-h-10"
            {...register("username")}
          />
          {errors.username ? (
            <p className="text-neg text-xs">{errors.username.message}</p>
          ) : null}
        </div>

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

        <PasswordField
          id="password"
          label="Password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="scl-link inline-flex min-h-10 items-center text-sm font-medium"
          >
            Forgot Password?
          </Link>
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Log in"}
        </Button>
      </form>

      {/*
        Profiles carried over from the previous platform were imported without a
        password, so their first sign-in attempt can only fail. Nothing on this
        screen would tell them why, and "Forgot Password" reads as wrong to
        someone who never had one — so the claim route is named outright.
      */}
      <p className="border-border text-muted-foreground mt-6 border-t pt-5 text-center text-sm">
        Brought your record over from the previous platform?{" "}
        <Link
          href="/forgot-password"
          className="scl-link inline-flex min-h-10 items-center font-medium"
        >
          Claim your account
        </Link>{" "}
        to set a password.
      </p>

      <p className="text-muted-foreground mt-2 text-center text-sm">
        New to SCL?{" "}
        <Link
          href="/signup"
          className="scl-link inline-flex min-h-10 items-center font-medium"
        >
          Create an account
        </Link>
      </p>
    </>
  );
}
