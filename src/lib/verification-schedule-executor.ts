import "server-only";

import {
  fetchEventOddsForVerification,
  fetchUpcomingOdds,
  getLastOddsApiRemaining,
  getLastOddsApiRunCost,
  resetLastOddsApiRunCost,
} from "@/lib/odds-api";
import { completeOddsRun, failOddsRun } from "@/lib/odds-control-runtime";
import { prisma } from "@/lib/prisma";
import type { ClaimedVerificationScheduleRun } from "@/lib/verification-schedule-runtime";

export async function executeVerificationScheduleRun(
  run: ClaimedVerificationScheduleRun,
) {
  resetLastOddsApiRunCost();
  try {
    const events = await fetchUpcomingOdds(run.sport, {
      leagues: run.league ? [run.league] : undefined,
    });
    const scoped = events
      .filter((event) => !run.league || event.league === run.league)
      .slice(0, run.maxEvents);
    let verified = 0;
    // Keep large slate runs inside the scheduler window without creating an
    // unbounded provider spike. Each request still reserves credits atomically.
    for (let index = 0; index < scoped.length; index += 4) {
      const results = await Promise.all(
        scoped.slice(index, index + 4).map((event) =>
          fetchEventOddsForVerification(run.sport, event.id, {
            league: event.league ?? run.league,
            markets: run.markets,
            purpose: "verify",
          }),
        ),
      );
      verified += results.filter(Boolean).length;
    }
    const credits = getLastOddsApiRunCost();
    const ok = verified === scoped.length && scoped.length > 0;
    await completeOddsRun(run.id, {
      ok,
      credits,
      remaining: getLastOddsApiRemaining(),
      details: {
        scheduleId: run.scheduleId,
        scope: run.league ? "LEAGUE" : "SLATE",
        league: run.league,
        eventsAvailable: events.length,
        eventsAttempted: scoped.length,
        eventsVerified: verified,
      },
      error: ok
        ? undefined
        : scoped.length
          ? "Some event verifications were blocked or unavailable."
          : "No events were available in this scope.",
    });
    await prisma.oddsVerificationSchedule.update({
      where: { id: run.scheduleId },
      data: { lastStatus: ok ? "COMPLETED" : "FAILED" },
    });
    return { id: run.id, sport: run.sport, tier: "verification", ok, credits };
  } catch (error) {
    await failOddsRun(run.id, error);
    await prisma.oddsVerificationSchedule
      .update({
        where: { id: run.scheduleId },
        data: { lastStatus: "FAILED" },
      })
      .catch(() => undefined);
    return {
      id: run.id,
      sport: run.sport,
      tier: "verification",
      ok: false,
      credits: 0,
    };
  }
}
