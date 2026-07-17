"use client";

import { useId } from "react";

/**
 * SCL trophy mark — pink→blue brand gradient (conviction → navigation).
 * Token-driven so it follows dark/light pink/blue values.
 */
export function SclLogo({ className }: { className?: string }) {
  const gradId = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-label="SCL"
    >
      <defs>
        <linearGradient
          id={gradId}
          x1="6"
          y1="4"
          x2="26"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="var(--scl-pink)" />
          <stop offset="50%" stopColor="var(--scl-pink)" />
          <stop offset="100%" stopColor="var(--scl-blue)" />
        </linearGradient>
      </defs>
      {/* crown — conviction pink */}
      <path
        d="M9.4 10.2 7.8 4.7 12 7.3 16 3.4 20 7.3 24.2 4.7 22.6 10.2Z"
        fill="var(--scl-pink)"
      />
      {/* cup bowl */}
      <path
        d="M9.4 11.2h13.2v2.1c0 4.8-2.95 8-6.6 8s-6.6-3.2-6.6-8z"
        fill={`url(#${gradId})`}
      />
      {/* handles */}
      <path
        d="M9.4 12.2c-3.4 0-3.4 4.5.2 4.9M22.6 12.2c3.4 0 3.4 4.5-.2 4.9"
        stroke={`url(#${gradId})`}
        strokeWidth="1.7"
        strokeLinecap="round"
        fill="none"
      />
      {/* stem + base — resolve into navigation blue */}
      <path d="M14.6 21.1h2.8l-.3 3h-2.2z" fill="var(--scl-blue)" />
      <rect
        x="11.3"
        y="24.1"
        width="9.4"
        height="3"
        rx="1.4"
        fill="var(--scl-blue)"
      />
    </svg>
  );
}
