import { notFound } from "next/navigation";

import { CapperProfileHeader } from "@/components/scl/capper-profile-header";
import { CapperStorefront } from "@/components/scl/capper-storefront";
import { EvidenceBrief } from "@/components/scl/evidence-brief";
import { ProfileTopPackages } from "@/components/scl/profile-top-packages";
import type { CapperSummary } from "@/lib/mock";
import type { PackageEvidence } from "@/lib/package-register";
import { toLegacySportRecordView } from "@/lib/legacy-sport-records";
import { buildProfileChartSeries } from "@/lib/profile-chart-window";
import {
  buildProfileWindowStats,
  selectDefaultProfileWindow,
  type ProfilePerfWindow,
  type ProfilePosition,
} from "@/lib/profile-performance-windows";
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
    headline: "Inspectable MLB pricing and market discipline.",
    specialties: ["Moneyline", "Run line"],
    storefront: {
      title: "Pete's Marketplace",
      description: "Board-tracked packages — inspect before you buy.",
      enabled: true,
      customized: true,
    },
  };

  const plays: PlayView[] = Array.from({ length: 12 }, (_, index) => {
    const loss = index % 4 === 2;
    return {
      id: `qa-play-${index + 1}`,
      sport: "MLB",
      league: null,
      market: index % 2 === 0 ? "Moneyline" : "Run Line",
      selection: index % 2 === 0 ? "Yankees" : "Yankees -1.5",
      oddsAmerican: index === 0 ? -120 : -110,
      units: 1,
      outcome: loss ? "LOSS" : "WIN",
      profitUnits: loss ? -1 : index === 0 ? 0.83 : 0.91,
      createdAt: new Date(Date.UTC(2026, 6, 17 - index, 18, 0, 0)),
      verificationTier: "VERIFIED",
      side: "Yankees",
      eventStartsAt: new Date(Date.UTC(2026, 6, 17 - index, 23, 5, 0)),
      book: "draftkings",
      notes: null,
      closingOddsAmerican: index === 0 ? -115 : -108,
      clvPts: index === 0 ? 0.9 : 0.4,
    };
  });

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
      promoOffer: null,
    },
  ];
  const packageEvidence: PackageEvidence = {
    settledPicks: capper.settledPicks ?? 0,
    record: capper.record,
    roi: capper.roi,
    units: capper.units,
    verifiedShare: null,
    provisional: false,
  };
  // Anchored so the gate renders the same section on every run, whatever the
  // real date is. Without a fixed `now` the scope bar would drift out of the
  // fixture's own slate week and the shot would stop being comparable.
  const qaNow = new Date(Date.UTC(2026, 6, 18));
  const packageChart = buildProfileChartSeries(plays, qaNow);

  const positions: ProfilePosition[] = plays.map((play) => ({
    slateAt: play.eventStartsAt ?? play.createdAt,
    createdAt: play.createdAt,
    outcome: play.outcome,
    units: play.units,
    profitUnits: play.profitUnits,
    sport: play.sport,
    clvPts: play.clvPts,
  }));
  const windowStats = buildProfileWindowStats({ positions, now: qaNow });
  const defaultWindow = selectDefaultProfileWindow(windowStats);
  const chartSeries = buildProfileChartSeries(positions, qaNow);
  const windowSportBreakdown = Object.fromEntries(
    (Object.keys(windowStats) as ProfilePerfWindow[]).map((key) => [
      key,
      windowStats[key].bySport.map((row) =>
        toLegacySportRecordView({
          sport: row.sport,
          wins: row.wins,
          losses: row.losses,
          pushes: row.pushes,
          unitsRisked: row.stakedUnits,
          unitsNet: row.units,
        }),
      ),
    ]),
  ) as Record<ProfilePerfWindow, ReturnType<typeof toLegacySportRecordView>[]>;

  return (
    <div className="overflow-x-hidden pb-6 sm:pb-8" data-visual-mode="proof">
      <CapperProfileHeader capper={capper} />
      <div className="mx-auto mt-4 max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <ProfileTopPackages
          packages={[{ pkg: packages[0], evidence: packageEvidence }]}
          totalCount={1}
        />
        <p className="text-muted-foreground mb-3 text-xs tracking-[0.08em] uppercase">
          QA fixture · desktop profile composition
        </p>
        <EvidenceBrief
          capper={capper}
          plays={plays}
          avgClv={1.2}
          chartSeries={chartSeries}
          windowStats={windowStats}
          windowSportBreakdown={windowSportBreakdown}
          defaultWindow={defaultWindow}
          packageInsights={[
            {
              id: packages[0].id,
              title: packages[0].title,
              evidence: packageEvidence,
              chartSeries: packageChart,
              chartSeriesBySport: { MLB: packageChart },
              sports: ["MLB"],
            },
          ]}
          emptyName={capper.name}
        />
        <div className="border-border mt-8 border-t pt-6">
          <CapperStorefront
            className="mt-0"
            storefront={capper.storefront}
            capperName={capper.name}
            packages={packages}
          />
        </div>
      </div>
    </div>
  );
}
