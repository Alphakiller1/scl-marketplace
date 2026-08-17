"use client";

import { useEffect } from "react";

import "./globals.css";

/**
 * Last-resort boundary for a throw in the root layout itself, which `error.tsx`
 * cannot catch — it sits inside that layout.
 *
 * This file REPLACES the root layout when active, so it ships its own <html>
 * and <body>. `next-themes` never mounts here, which is why `dark` is written
 * on <html> directly: the app runs `defaultTheme="dark"`, and a fallback that
 * flashed light would look like a different site at the worst moment. Styling
 * stays inline for the same reason — this page has to render even if the
 * stylesheet is part of what failed.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[global error]", error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0d12",
          color: "#f5f6f8",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
          padding: "2rem 1rem",
        }}
      >
        <main style={{ maxWidth: "32rem", textAlign: "center" }}>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              letterSpacing: "0.01em",
              margin: 0,
            }}
          >
            SCL is temporarily unavailable
          </h1>
          <p
            style={{
              marginTop: "0.75rem",
              lineHeight: 1.6,
              color: "#a7adba",
              fontSize: "0.95rem",
            }}
          >
            Something failed while loading the application shell. Your account
            and your logged plays are unaffected.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              marginTop: "1.5rem",
              minHeight: "2.75rem",
              padding: "0 1.5rem",
              borderRadius: "0.625rem",
              border: "1px solid #2a2f3a",
              background: "#105fd9",
              color: "#fff",
              fontSize: "0.95rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest ? (
            <p
              style={{
                marginTop: "1rem",
                fontSize: "0.75rem",
                color: "#6f7787",
              }}
            >
              Reference {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
