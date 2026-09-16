"use client";

import { useState, type ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { parseStakeDraft } from "@/lib/prediction-units";

function display(value: number): string {
  return Number.isFinite(value) ? String(value) : "";
}

/**
 * Unit entry that lets the capper type freely. A number input clamped on every
 * keystroke snapped "0.0" back to 0.01, so backspace did nothing and ".5"
 * never got past the leading dot. The draft text is kept while typing; a
 * usable number is sent up as soon as there is one, and the field settles on
 * the stored (clamped) value when it loses focus.
 */
export function StakeInput({
  value,
  onValueChange,
  ...props
}: Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: number;
  onValueChange: (units: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={draft ?? display(value)}
      onFocus={(event) => {
        setDraft(display(value));
        event.currentTarget.select();
        props.onFocus?.(event);
      }}
      onChange={(event) => {
        const parsed = parseStakeDraft(event.target.value);
        if (parsed === undefined) return;
        setDraft(event.target.value);
        if (parsed !== null) onValueChange(parsed);
      }}
      onBlur={(event) => {
        setDraft(null);
        props.onBlur?.(event);
      }}
    />
  );
}
