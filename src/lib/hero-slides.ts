/**
 * LOCKED hero CTA language — design/MOCKUP_FIDELITY_HOME_CONTRACT.md
 * Do not rewrite without an OWNER decision.
 */
export type HeroSlide = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  cta: string;
};

export const HERO_SLIDES: HeroSlide[] = [
  {
    id: "founding",
    eyebrow: "Founding Roster Forming",
    title: "Apply As A Founding Capper",
    body: "Build a public, inspectable record from day one — every pick, timestamp, line, and result visible before you send bettors anywhere.",
    href: "/signup",
    cta: "Track Your Record",
  },
  {
    id: "discover",
    eyebrow: "Discover Cappers",
    title: "Find & Tail The Best Cappers In The World",
    body: "Compare board-verified records by units, ROI, and sample size — then follow the cappers whose process holds up under inspection.",
    href: "/leaderboard",
    cta: "Explore Leaderboard",
  },
  {
    id: "verify",
    eyebrow: "Track & Verify",
    title: "Sell, Track, & Verify Your Predictions",
    body: "Log board-verified plays, earn a public rank others can check, and keep payments on your own storefront. SCL does not process payments.",
    href: "/signup",
    cta: "Track Your Record",
  },
];
