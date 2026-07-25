"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn, ShieldCheck } from "lucide-react";
import { signIn, getSession } from "next-auth/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthFormSkeleton, AuthHeader } from "@/components/scl/auth-header";
import { PasswordField } from "@/components/scl/password-field";
import { defaultPathForRole } from "@/lib/commerce-settings";
import { safeCallbackPath } from "@/lib/safe-redirect";
import {
  resendLoginCodeAction,
  startLoginAction,
} from "@/lib/actions/admin-login.action";
import { loginSchema, type LoginInput } from "@/lib/schemas/auth.schema";

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

/** Admin sign-in pauses here until the emailed code is entered. */
type CodeStep = { email: string; challengeId: string; devCode?: string };

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = safeCallbackPath(params.get("callbackUrl"));
  const [codeStep, setCodeStep] = useState<CodeStep | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function finishSignIn(credentials: Record<string, string>) {
    const result = await signIn("credentials", {
      ...credentials,
      redirect: false,
    });
    if (!result || result.error) {
      toast.error("Unable to sign in with those credentials");
      return;
    }
    const session = await getSession();
    const destination = callbackUrl ?? defaultPathForRole(session?.user?.role);
    toast.success("Welcome back");
    router.push(destination);
    router.refresh();
  }

  async function onSubmit(values: LoginInput) {
    try {
      const started = await startLoginAction(values);
      if (!started.ok) {
        toast.error(started.error);
        return;
      }

      if (started.mode === "code") {
        setCodeStep({
          email: values.email,
          challengeId: started.challengeId,
          devCode: started.devCode,
        });
        toast.success("We emailed you a sign-in code");
        return;
      }

      await finishSignIn(values);
    } catch {
      toast.error("Couldn't sign you in. Please try again in a moment.");
    }
  }

  if (codeStep) {
    return (
      <CodeStepForm
        step={codeStep}
        onStepChange={setCodeStep}
        onCancel={() => setCodeStep(null)}
        onVerify={(code) =>
          finishSignIn({
            email: codeStep.email,
            challengeId: codeStep.challengeId,
            code,
          })
        }
      />
    );
  }

  return (
    <>
      <AuthHeader
        icon={LogIn}
        eyebrow="Secure Access"
        title="Welcome Back"
        description="Open your capper workspace and verified record."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-brand inline-flex min-h-11 items-center text-sm font-medium hover:underline"
          >
            Forgot Password?
          </Link>
        </div>

        <Button
          type="submit"
          className="min-h-11 w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Signing In…" : "Log In"}
        </Button>
      </form>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        New to SCL?{" "}
        <Link
          href="/signup"
          className="text-brand inline-flex min-h-11 items-center font-medium hover:underline"
        >
          Capper signup
        </Link>
        {" · "}
        <Link
          href="/signup/customer"
          className="text-brand inline-flex min-h-11 items-center font-medium hover:underline"
        >
          Customer signup
        </Link>
      </p>
    </>
  );
}

function CodeStepForm({
  step,
  onStepChange,
  onCancel,
  onVerify,
}: {
  step: CodeStep;
  onStepChange: (step: CodeStep) => void;
  onCancel: () => void;
  onVerify: (code: string) => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      toast.error("Enter the 6-digit code from your email");
      return;
    }
    setPending(true);
    try {
      await onVerify(code);
    } finally {
      setPending(false);
    }
  }

  async function resend() {
    setResending(true);
    try {
      const result = await resendLoginCodeAction(step.challengeId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.mode === "code") {
        // Replace devCode rather than merging: a delivered resend must clear the
        // dev fallback left over from a previous attempt.
        onStepChange({
          email: step.email,
          challengeId: result.challengeId,
          devCode: result.devCode,
        });
        setCode("");
        toast.success("New code sent");
      }
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <AuthHeader
        icon={ShieldCheck}
        eyebrow="Admin Verification"
        title="Enter Your Code"
        description={`We sent a 6-digit code to ${step.email}. It expires in 10 minutes.`}
      />

      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="code">Sign-in code</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            className="min-h-11 text-center text-lg tracking-[0.5em]"
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
          />
          {step.devCode ? (
            <p className="text-muted-foreground text-xs">
              Email delivery isn&apos;t configured — your code is{" "}
              <span className="font-semibold">{step.devCode}</span>.
            </p>
          ) : null}
        </div>

        <Button type="submit" className="min-h-11 w-full" disabled={pending}>
          {pending ? "Verifying…" : "Verify & Sign In"}
        </Button>
      </form>

      <div className="text-muted-foreground mt-6 flex justify-between text-sm">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-11 items-center font-medium hover:underline"
        >
          Back
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={resending}
          className="text-brand inline-flex min-h-11 items-center font-medium hover:underline disabled:opacity-60"
        >
          {resending ? "Sending…" : "Resend code"}
        </button>
      </div>
    </>
  );
}
