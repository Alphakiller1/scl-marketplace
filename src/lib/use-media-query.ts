"use client";

import { useEffect, useState } from "react";

/**
 * Client media query. `null` until mounted so SSR/hydration don't flash the wrong branch.
 * Use for mutually exclusive mobile/desktop trees (e.g. one slip form instance).
 */
export function useMediaQuery(query: string): boolean | null {
  const [matches, setMatches] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);

  return matches;
}

/** Tailwind `lg` breakpoint (1024px). */
export function useIsLg(): boolean | null {
  return useMediaQuery("(min-width: 1024px)");
}
