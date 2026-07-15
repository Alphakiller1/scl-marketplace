"use client";

import { UnifiedPickEntry } from "@/components/scl/unified-pick-entry";

/**
 * Straight / unified entry — M5 PR-3.
 * Mode defaults to Singles; Parlay is an in-slip toggle (no separate board).
 */
export default function NewPlayPage() {
  return <UnifiedPickEntry initialMode="singles" />;
}
