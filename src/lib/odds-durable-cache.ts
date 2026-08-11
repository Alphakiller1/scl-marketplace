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
