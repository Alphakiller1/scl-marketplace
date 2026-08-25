/**
 * Write already-fetched odds snapshots into `scl.OddsCacheSnapshot` — no
 * provider calls, no credits.
 *
 * `populate-odds-today.ts` spends real Odds API credits to build a slate and
 * then writes it only if it happens to hold a database connection. When it does
 * not — a fetch run from a machine without the production URL — the credits are
 * spent and the slate is stranded in a JSON file. This replays that file, so a
 * paid-for slate can be written from wherever the database actually is, and can
 * be re-applied without paying for it twice.
 *
 *   SNAPSHOT_FILE=data/odds-snapshots/<file>.json.gz npx tsx scripts/write-odds-snapshots.ts
 *
 * KINDS=board,event-board   which snapshot kinds to write (default both)
 * SPORTS=MLB,WNBA           restrict to these SCL sports (default all)
 * DRY_RUN=1                 report what would be written, touch nothing
 *
 * Board snapshots keep the last-known-good contract: a future fixture already
 * in the row and absent from the file is retained rather than dropped, exactly
 * as `mergeLastGoodBoardEvents` does on the live path.
 */
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";

import type { OddsEvent } from "@/lib/odds-board";
import { mergeLastGoodBoardEvents } from "@/lib/manual-odds-population";

type Snapshot = { key: string; payload: Record<string, unknown> };

const FILE = process.env.SNAPSHOT_FILE?.trim();
if (!FILE) throw new Error("SNAPSHOT_FILE is required");
const KINDS = (process.env.KINDS ?? "board,event-board")
  .split(",")
  .map((kind) => kind.trim().toLowerCase())
  .filter(Boolean);
const SPORTS = (process.env.SPORTS ?? "")
  .split(",")
  .map((sport) => sport.trim().toUpperCase())
  .filter(Boolean);
const DRY_RUN = process.env.DRY_RUN === "1";

/** Mirrors ODDS_BOARD_RETENTION_SECONDS / ODDS_EVENT_RETENTION_SECONDS. */
const RETENTION_SECONDS = 30 * 24 * 60 * 60;

/** `board:v1:MLB` -> "board"; `event-board:v1:MLB:<id>` -> "event-board". */
function snapshotKind(key: string): string {
  return key.startsWith("event-board:") ? "event-board" : "board";
}

function snapshotSport(key: string): string {
  return (key.split(":")[2] ?? "").toUpperCase();
}

function wanted(snapshot: Snapshot): boolean {
  if (!KINDS.includes(snapshotKind(snapshot.key))) return false;
  return SPORTS.length === 0 || SPORTS.includes(snapshotSport(snapshot.key));
}

function readSnapshots(): Snapshot[] {
  const raw = readFileSync(FILE!);
  const text = FILE!.endsWith(".gz")
    ? gunzipSync(raw).toString("utf8")
    : raw.toString("utf8");
  const parsed = JSON.parse(text) as { snapshots?: Snapshot[] };
  if (!Array.isArray(parsed.snapshots)) {
    throw new Error(`${FILE} has no "snapshots" array`);
  }
  return parsed.snapshots;
}

async function main() {
  const all = readSnapshots();
  const selected = all.filter(wanted);
  console.log(
    `${FILE}: ${all.length} snapshots, ${selected.length} selected (kinds ${KINDS.join("+")}${SPORTS.length ? `, sports ${SPORTS.join("+")}` : ""})`,
  );
  for (const snapshot of selected) {
    const payload = snapshot.payload;
    const rows = Array.isArray(payload.events)
      ? payload.events.length
      : Array.isArray(payload.selections)
        ? payload.selections.length
        : 0;
    console.log(`  ${snapshot.key.padEnd(56)} ${rows}`);
  }
  if (DRY_RUN) {
    console.log("DRY_RUN=1 — nothing written.");
    return;
  }
  if (selected.length === 0) return;

  // Imported lazily so a dry run needs no database at all.
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    for (const snapshot of selected) {
      if (snapshotKind(snapshot.key) === "board") {
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
      console.log(`  wrote ${snapshot.key}`);
    }
    console.log(`\ndatabase: ${selected.length} snapshots upserted`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
