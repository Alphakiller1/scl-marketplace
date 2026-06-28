/**
 * SCL trophy mark — a crowned trophy in the brand pink→blue gradient (token-driven, so it
 * follows the theme). Used in the site/app headers and anywhere the brand needs a glyph.
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
      <defs>
        <linearGradient
          id="scl-logo-grad"
          x1="5"
          y1="3"
          x2="27"
          y2="29"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--brand)" />
          <stop offset="0.55" stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--primary)" />
        </linearGradient>
      </defs>
      {/* crown */}
      <path
        d="M9.4 10.2 7.8 4.7 12 7.3 16 3.4 20 7.3 24.2 4.7 22.6 10.2Z"
        fill="url(#scl-logo-grad)"
      />
      {/* cup bowl */}
      <path
        d="M9.4 11.2h13.2v2.1c0 4.8-2.95 8-6.6 8s-6.6-3.2-6.6-8z"
        fill="url(#scl-logo-grad)"
      />
      {/* handles */}
      <path
        d="M9.4 12.2c-3.4 0-3.4 4.5.2 4.9M22.6 12.2c3.4 0 3.4 4.5-.2 4.9"
        stroke="url(#scl-logo-grad)"
        strokeWidth="1.7"
        strokeLinecap="round"
        fill="none"
      />
      {/* stem + base */}
      <path d="M14.6 21.1h2.8l-.3 3h-2.2z" fill="url(#scl-logo-grad)" />
      <rect
        x="11.3"
        y="24.1"
        width="9.4"
        height="3"
        rx="1.4"
        fill="url(#scl-logo-grad)"
      />
    </svg>
  );
}
