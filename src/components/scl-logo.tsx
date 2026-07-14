/**
 * SCL trophy mark — Settlement Gold (scarce identity signal).
 * Token-driven so it follows dark/light gold values.
 */
export function SclLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-label="SCL"
    >
      {/* crown */}
      <path
        d="M9.4 10.2 7.8 4.7 12 7.3 16 3.4 20 7.3 24.2 4.7 22.6 10.2Z"
        fill="var(--scl-gold)"
      />
      {/* cup bowl */}
      <path
        d="M9.4 11.2h13.2v2.1c0 4.8-2.95 8-6.6 8s-6.6-3.2-6.6-8z"
        fill="var(--scl-gold)"
      />
      {/* handles */}
      <path
        d="M9.4 12.2c-3.4 0-3.4 4.5.2 4.9M22.6 12.2c3.4 0 3.4 4.5-.2 4.9"
        stroke="var(--scl-gold)"
        strokeWidth="1.7"
        strokeLinecap="round"
        fill="none"
      />
      {/* stem + base */}
      <path d="M14.6 21.1h2.8l-.3 3h-2.2z" fill="var(--scl-gold)" />
      <rect
        x="11.3"
        y="24.1"
        width="9.4"
        height="3"
        rx="1.4"
        fill="var(--scl-gold)"
      />
    </svg>
  );
}
