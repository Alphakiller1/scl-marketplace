import assert from "node:assert/strict";
import { test } from "node:test";

import { HERO_SLIDES } from "@/lib/hero-slides";

/**
 * Owner lock — design/MOCKUP_FIDELITY_HOME_CONTRACT.md
 * Visual fidelity work must not rewrite hero CTA language.
 */
test("hero CTA language remains owner-locked", () => {
  assert.deepEqual(
    HERO_SLIDES.map((s) => ({
      id: s.id,
      eyebrow: s.eyebrow,
      title: s.title,
      cta: s.cta,
      href: s.href,
      body: s.body,
    })),
    [
      {
        id: "founding",
        eyebrow: "Founding Roster Forming",
        title: "Apply As A Founding Capper",
        cta: "Track Your Record",
        href: "/signup",
        body: "Build a public, inspectable record from day one — every pick, timestamp, line, and result visible before you send bettors anywhere.",
      },
      {
        id: "discover",
        eyebrow: "Discover Cappers",
        title: "Find & Tail The Best Cappers In The World",
        cta: "Explore Leaderboard",
        href: "/leaderboard",
        body: "Compare board-verified records by units, ROI, and sample size — then follow the cappers whose process holds up under inspection.",
      },
      {
        id: "verify",
        eyebrow: "Track & Verify",
        title: "Sell, Track, & Verify Your Predictions",
        cta: "Track Your Record",
        href: "/signup",
        body: "Log board-verified plays, earn a public rank others can check, and keep payments on your own storefront. SCL does not process payments.",
      },
    ],
  );
});
