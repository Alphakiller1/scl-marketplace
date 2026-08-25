import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

import { NextRequest, NextResponse } from "next/server";

import { mergeLastGoodBoardEvents } from "@/lib/manual-odds-population";
import type { OddsEvent } from "@/lib/odds-board";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

const SNAPSHOT_FILE = "2026-08-25T15-08Z.json.gz";
const RETENTION_SECONDS = 30 * 24 * 60 * 60;

type Snapshot = { key: string; payload: Record<string, unknown> };

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = req.headers.get("authorization");
  return Boolean(
    secret &&
    (authorization === secret || authorization === `Bearer ${secret}`),
  );
}

function readSnapshots(): Snapshot[] {
  const file = join(process.cwd(), "data", "odds-snapshots", SNAPSHOT_FILE);
  const parsed = JSON.parse(
    gunzipSync(readFileSync(file)).toString("utf8"),
  ) as { snapshots?: Snapshot[] };
  if (!Array.isArray(parsed.snapshots)) {
    throw new Error(`${SNAPSHOT_FILE} has no snapshots array`);
  }
  return parsed.snapshots;
}

function isBoard(key: string): boolean {
  return key.startsWith("board:");
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshots = readSnapshots();
  const existing = await prisma.oddsCacheSnapshot.count();
  if (existing === 0) {
    return NextResponse.json(
      { ok: false, error: "The SCL odds cache is unexpectedly empty." },
      { status: 409 },
    );
  }

  const rows: Array<{ key: string; rows: number }> = [];
  for (const snapshot of snapshots) {
    if (isBoard(snapshot.key)) {
      const prior = await prisma.oddsCacheSnapshot.findUnique({
        where: { key: snapshot.key },
        select: { payload: true },
      });
      const priorEvents =
        prior?.payload &&
        typeof prior.payload === "object" &&
        "events" in prior.payload &&
        Array.isArray(prior.payload.events)
          ? (prior.payload.events as unknown as OddsEvent[])
          : [];
      snapshot.payload.events = mergeLastGoodBoardEvents(
        snapshot.payload.events as unknown as OddsEvent[],
        priorEvents,
      );
    }

    const savedAtMs = Number(snapshot.payload.savedAt);
    if (!Number.isFinite(savedAtMs)) {
      throw new Error(`Snapshot ${snapshot.key} has no valid savedAt value`);
    }
    const savedAt = new Date(savedAtMs);
    const expiresAt = new Date(savedAtMs + RETENTION_SECONDS * 1_000);
    await prisma.oddsCacheSnapshot.upsert({
      where: { key: snapshot.key },
      create: {
        key: snapshot.key,
        payload: snapshot.payload as never,
        savedAt,
        expiresAt,
      },
      update: { payload: snapshot.payload as never, savedAt, expiresAt },
    });
    rows.push({
      key: snapshot.key,
      rows: Array.isArray(snapshot.payload.events)
        ? snapshot.payload.events.length
        : Array.isArray(snapshot.payload.selections)
          ? snapshot.payload.selections.length
          : 0,
    });
  }

  return NextResponse.json({
    ok: true,
    file: SNAPSHOT_FILE,
    written: rows.length,
    rows,
    providerCreditsSpent: 0,
  });
}
