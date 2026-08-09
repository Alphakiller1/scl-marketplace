import { NextResponse } from "next/server";

import { slimBoardCapper } from "@/lib/board-capper";
import { type LeaderboardWindow } from "@/lib/leaderboard";
import { getLeaderboardResult } from "@/lib/queries/leaderboard";

const HOME_WINDOWS = new Set<LeaderboardWindow>([
  "1d",
  "7d",
  "14d",
  "30d",
  "90d",
  "all",
]);

export async function GET(request: Request) {
  const requestedWindow = new URL(request.url).searchParams.get("window");
  if (!HOME_WINDOWS.has(requestedWindow as LeaderboardWindow)) {
    return NextResponse.json(
      { error: "Unsupported leaderboard window" },
      { status: 400 },
    );
  }

  const result = await getLeaderboardResult({
    window: requestedWindow as LeaderboardWindow,
    verifiedOnly: false,
  });

  return NextResponse.json({
    failed: result.failed,
    cappers: result.cappers.map(slimBoardCapper),
  });
}
