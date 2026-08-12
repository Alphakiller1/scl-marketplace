import { NextRequest, NextResponse } from "next/server";
import {
  getStrategicOddsBoardStatus,
  runStrategicOddsRefresh,
} from "@/lib/strategic-odds-refresh";
import {
  getCachedOddsCoverageReport,
  warmMissingOddsCoverage,
} from "@/lib/odds-coverage-report";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || req.headers.get("authorization") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runStrategicOddsRefresh();
  const coverageBefore = await getCachedOddsCoverageReport();
  const oddsWarmup = coverageBefore.marketComplete
    ? null
    : await warmMissingOddsCoverage(coverageBefore);
  const oddsCoverage = oddsWarmup
    ? await getCachedOddsCoverageReport()
    : coverageBefore;
  const boardStatus = await getStrategicOddsBoardStatus();
  const expandedFailures = oddsCoverage.games
    .filter((game) => !game.fullyCovered)
    .map((game) => ({
      eventId: game.eventId,
      sport: game.sport,
      matchup: game.matchup,
      missing: game.missing,
    }));
  const ok =
    result.verificationFailures.length === 0 && expandedFailures.length === 0;
  return NextResponse.json(
    {
      ok,
      ...result,
      oddsWarmup,
      oddsCoverage: {
        totalGames: oddsCoverage.totalGames,
        gamesFullyCovered: oddsCoverage.gamesFullyCovered,
        marketComplete: oddsCoverage.marketComplete,
      },
      expandedFailures,
      boardStatus,
    },
    { status: ok ? 200 : 503 },
  );
}
