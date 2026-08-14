/**
 * Meta Pixel event helpers.
 *
 * The base snippet is injected by `MetaPixel` (src/components/providers/meta-pixel.tsx).
 * Every function here is a no-op when the pixel is absent or storage is blocked — a
 * tracking problem must never be able to break signup.
 */

declare global {
  interface Window {
    fbq?: (
      command: "init" | "track" | "trackCustom",
      target: string,
      params?: Record<string, unknown>,
      options?: { eventID?: string },
    ) => void;
  }
}

/** One CompleteRegistration per browser session, whatever the UI does above it. */
const REGISTRATION_FIRED_KEY = "scl.meta.registration-fired";

/** Returns true if this key has already fired; otherwise claims it and returns false. */
function claimOnce(key: string): boolean {
  try {
    if (window.sessionStorage.getItem(key)) return true;
    window.sessionStorage.setItem(key, "1");
    return false;
  } catch {
    // Storage blocked — private mode, or an embedded in-app browser. Fire anyway: a rare
    // duplicate is a better failure than systematically dropping mobile conversions.
    return false;
  }
}

export function trackPageView(): void {
  if (typeof window === "undefined") return;
  window.fbq?.("track", "PageView");
}

export function trackCompleteRegistration(method: string): void {
  if (typeof window === "undefined") return;
  if (claimOnce(REGISTRATION_FIRED_KEY)) return;

  window.fbq?.("track", "CompleteRegistration", {
    content_name: "SCL capper signup",
    registration_method: method,
    status: true,
  });
}

export {};
