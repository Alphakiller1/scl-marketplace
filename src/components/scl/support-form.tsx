"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  submitSupportRequest,
  type SupportFormState,
} from "@/lib/actions/support.action";

const initialState: SupportFormState = { status: "idle" };
const controlClass =
  "border-border bg-background text-foreground focus-visible:ring-ring min-h-11 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2";

export function SupportForm() {
  const [state, action, pending] = useActionState(
    submitSupportRequest,
    initialState,
  );

  return (
    <form action={action} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Email" error={state.errors?.email?.[0]}>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className={controlClass}
          />
        </Field>
        <Field
          label="What can we help with?"
          error={state.errors?.category?.[0]}
        >
          <select
            name="category"
            required
            defaultValue=""
            className={controlClass}
          >
            <option value="" disabled>
              Select a category
            </option>
            {[
              "Account",
              "Capper profile",
              "Pick or grading",
              "Package or purchase link",
              "Technical issue",
              "Other",
            ].map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Page URL (optional)" error={state.errors?.pageUrl?.[0]}>
        <input
          name="pageUrl"
          type="url"
          placeholder="https://…"
          className={controlClass}
        />
      </Field>

      <Field label="Message" error={state.errors?.message?.[0]}>
        <textarea
          name="message"
          required
          rows={7}
          maxLength={4000}
          className={controlClass}
          placeholder="Tell us what happened and what you expected."
        />
      </Field>

      <div className="hidden" aria-hidden>
        <label>
          Company
          <input name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {state.message ? (
        <p
          role="status"
          className={
            state.status === "success"
              ? "text-sm text-[color:var(--scl-perf-win-text)]"
              : "text-sm text-[color:var(--scl-perf-loss-text)]"
          }
        >
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="min-h-11 gap-2">
        <Send className="size-4" aria-hidden />
        {pending ? "Sending…" : "Send request"}
      </Button>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2 text-sm font-medium">
      <span>{label}</span>
      {children}
      {error ? (
        <span className="block text-xs text-[color:var(--scl-perf-loss-text)]">
          {error}
        </span>
      ) : null}
    </label>
  );
}
