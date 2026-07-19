import { notFound } from "next/navigation";

import { CapperProfileHeader } from "@/components/scl/capper-profile-header";
import { EvidenceBrief } from "@/components/scl/evidence-brief";
import { ResponsiveCapperStorefront } from "@/components/scl/responsive-capper-storefront";
import type { CapperSummary } from "@/lib/mock";
import type { PlayView } from "@/lib/queries/plays";

/**
 * Local / Claude visual-gate fixture for desktop profile composition.
 * Production 404 unless ALLOW_QA_SHOTS=1 (never linked from nav).
 */
export default function DesktopProfileCompositionQaPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_QA_SHOTS !== "1"
  ) {
    notFound();
  }

  const capper: CapperSummary = {
    id: "qa-composition",
    name: "Pete's Picks",
    handle: "petespicks",
    verified: true,
    topSport: "MLB",
    rank: 3,
    rankDelta: 0,
    record: { w: 12, l: 8, p: 1 },
    winPct: 60,
    // Reproduce the colliding ROI/Units pair from the 1536 regression report.
    units: 4.36,
    roi: 109,
    streak: 2,
    recentForm: ["W", "W", "L", "W", "W", "L"],
    trophies: [],
    settledPicks: 21,
    verifiedShare: 86,
    avgClv: 1.2,
    storefront: {
      title: "Pete's Marketplace",
      description: "Board-tracked packages — inspect before you buy.",
      enabled: true,
      customized: true,
    },
  };

  const plays: PlayView[] = [
    {
      id: "qa-play-1",
      sport: "MLB",
      league: null,
      market: "Moneyline",
      selection: "Yankees",
      oddsAmerican: -120,
      units: 1,
      outcome: "WIN",
      profitUnits: 0.83,
      createdAt: new Date("2026-07-17T18:00:00Z"),
      verificationTier: "VERIFIED",
      side: "Yankees",
      eventStartsAt: new Date("2026-07-17T23:05:00Z"),
      book: "draftkings",
      notes: null,
      closingOddsAmerican: -115,
      clvPts: 0.9,
    },
  ];

  const packages = [
    {
      id: "qa-pkg-1",
      title: "Weekend MLB Card",
      description: "Inspectable board-tracked card.",
      priceLabel: "$49 / week",
      provider: "WHOP" as const,
      trackingPath: "/packages",
      capperName: capper.name,
      capperHandle: capper.handle,
    },
  ];

  return (
    <div className="overflow-x-hidden pb-6 sm:pb-8" data-visual-mode="proof">
      <CapperProfileHeader capper={capper} />
      <div className="mx-auto mt-4 max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <p className="text-muted-foreground mb-3 text-xs tracking-[0.08em] uppercase">
          QA fixture · desktop profile composition
        </p>
        <EvidenceBrief
          capper={capper}
          plays={plays}
          avgClv={1.2}
          emptyName={capper.name}
          desktopStorefront={
            <ResponsiveCapperStorefront
              viewport="desktop"
              className="mt-0"
              storefront={capper.storefront}
              capperName={capper.name}
              packages={packages}
            />
          }
        />
      </div>
    </div>
  );
}
