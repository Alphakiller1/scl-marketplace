"use client";

import { UnifiedPickEntry } from "@/components/scl/unified-pick-entry";

/**
 * Parlay deep-link — same unified board; slip opens in Parlay mode (M5 §2.1).
 */
export default function NewParlayPage() {
  return <UnifiedPickEntry initialMode="parlay" />;
}
