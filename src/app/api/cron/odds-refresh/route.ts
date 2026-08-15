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

  // Always 200 once the refresh has actually run. `ok` describes the QUALITY of
  // the resulting board; the status code describes whether the request was
  // serviced, and those are different questions.
  //
  // This returned 503 on incomplete coverage, which is a normal state — books
  // have not priced every market on every fixture at any given minute. The
  // caller (.github/workflows/odds-refresh.yml) ran curl with
  // `--retry 3 --retry-all-errors`, so each 503 bought three more full refreshes
  // at roughly 31 credits per event: one scheduled run cost 4x what it should.
  // The retry could never help either, since a re-run finds books still haven't
  // priced those markets and returns 503 again — it only ever spent credits.
  //
  // Incomplete coverage is reported in the body, and the workflow fails its job
  // on `ok: false` without re-requesting.
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
    { status: 200 },
  );
}
