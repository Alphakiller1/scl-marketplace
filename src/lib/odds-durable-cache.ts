import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** Read a deployment-independent odds snapshot while it is still retained. */
export async function readDurableOddsSnapshot(key: string): Promise<unknown> {
  try {
    const row = await prisma.oddsCacheSnapshot.findUnique({ where: { key } });
    if (!row || row.expiresAt.getTime() <= Date.now()) return null;
    return row.payload;
  } catch (error) {
    console.warn("[odds-durable-cache] read failed", {
      key,
      reason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** Upsert a JSON-safe last-good snapshot into PostgreSQL. */
export async function writeDurableOddsSnapshot(
  key: string,
  payload: unknown,
  savedAt: number,
  retentionSeconds: number,
): Promise<void> {
  try {
    const jsonPayload = JSON.parse(
      JSON.stringify(payload),
    ) as Prisma.InputJsonValue;
    const saved = new Date(savedAt);
    const expiresAt = new Date(savedAt + retentionSeconds * 1_000);
    await prisma.oddsCacheSnapshot.upsert({
      where: { key },
      create: { key, payload: jsonPayload, savedAt: saved, expiresAt },
      update: { payload: jsonPayload, savedAt: saved, expiresAt },
    });
  } catch (error) {
    console.warn("[odds-durable-cache] write failed", {
      key,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Which of these keys currently hold a retained snapshot.
 *
 * One indexed query instead of one per key. The coverage sweep asks "which of
 * tonight's fixtures has never had a board bought", which is a question about
 * existence, not content — reading fifteen 30KB payloads to answer it would
 * cost more than the sweep it guards.
 *
 * The durable store is the authority for that question: every write goes here
 * before the runtime cache, and the runtime cache is per-region and can be cold
 * on an isolate that has never served the sport.
 */
export async function readDurableOddsSnapshotKeys(
  keys: readonly string[],
): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  try {
    const rows = await prisma.oddsCacheSnapshot.findMany({
      where: { key: { in: [...keys] }, expiresAt: { gt: new Date() } },
      select: { key: true },
    });
    return new Set(rows.map((row) => row.key));
  } catch (error) {
    console.warn("[odds-durable-cache] key scan failed", {
      count: keys.length,
      reason: error instanceof Error ? error.message : String(error),
    });
    // An unreadable store must not invent missing boards — that would schedule
    // a catch-up pass for a slate that is already covered.
    return new Set(keys);
  }
}
