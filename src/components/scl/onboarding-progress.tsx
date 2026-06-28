import { Check, Circle } from "lucide-react";

import { cn } from "@/lib/utils";

type OnboardingProgressProps = {
  emailVerified: boolean;
  profileComplete: boolean;
};

export function OnboardingProgress({
  emailVerified,
  profileComplete,
}: OnboardingProgressProps) {
  const steps = [
    { label: "Account", complete: true },
    { label: "Verify", complete: emailVerified },
    { label: "Profile", complete: profileComplete },
  ];
  const activeIndex = steps.findIndex((step) => !step.complete);

  return (
    <nav aria-label="Capper onboarding progress">
      <ol className="grid grid-cols-3">
        {steps.map((step, index) => {
          const active = index === activeIndex;
          return (
            <li
              key={step.label}
              aria-current={active ? "step" : undefined}
              className="relative flex min-w-0 flex-col items-center gap-2"
            >
              {index > 0 ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-4 right-1/2 h-px w-full",
                    steps[index - 1].complete ? "bg-brand" : "bg-border",
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 flex size-8 items-center justify-center rounded-full border",
                  step.complete
                    ? "border-brand bg-brand text-brand-foreground"
                    : active
                      ? "border-brand bg-background text-brand"
                      : "border-border bg-background text-muted-foreground",
                )}
              >
                {step.complete ? (
                  <Check className="size-4" aria-hidden />
                ) : (
                  <Circle className="size-3" aria-hidden />
                )}
              </span>
              <span
                className={cn(
                  "text-xs font-medium",
                  step.complete || active
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
