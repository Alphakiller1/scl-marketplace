import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { loadTestModule } from "../src/lib/test-support/load-module";
import type * as Locks from "../src/lib/results/settlement-lock";

// This test writes fixtures. Refuse every non-local database, including previews.
const database = new URL(process.env.DATABASE_URL ?? "postgresql://invalid");
if (
  !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) ||
  database.searchParams.get("schema") !== "scl"
) {
  throw new Error(
    "Grading lock smoke requires an isolated local database in schema scl",
  );
}
const prisma = new PrismaClient();
const { lockParlaySettlement } = loadTestModule<typeof Locks>(
  "src/lib/results/settlement-lock.ts",
  { "server-only": {} },
);

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function main() {
  const user = await prisma.user.create({
    data: {
      email: `grading-lock-${randomUUID()}@example.invalid`,
      isTest: true,
      capperProfile: { create: {} },
    },
    include: { capperProfile: true },
  });
  try {
    const ticket = await prisma.parlay.create({
      data: { capperId: user.capperProfile!.id, units: 2 },
    });
    const leg = await prisma.play.create({
      data: {
        capperId: user.capperProfile!.id,
        parlayId: ticket.id,
        units: 0,
        sport: "TENNIS",
        market: "Moneyline",
        selection: "Test fixture",
        oddsAmerican: -200,
      },
    });
    const holding = deferred();
    const release = deferred();
    const attempting = deferred();
    let secondAcquired = false;
    const manual = prisma.$transaction(async (tx) => {
      await lockParlaySettlement(tx, ticket.id);
      await tx.play.update({
        where: { id: leg.id },
        data: { outcome: "VOID" },
      });
      await tx.parlay.update({
        where: { id: ticket.id },
        data: { outcome: "VOID", profitUnits: 0 },
      });
      holding.resolve();
      await release.promise;
    });
    await Promise.race([
      holding.promise,
      manual.then(() => {
        throw new Error("Lock fixture did not start");
      }),
    ]);
    const automatic = prisma.$transaction(async (tx) => {
      attempting.resolve();
      await lockParlaySettlement(tx, ticket.id);
      secondAcquired = true;
      const fresh = await tx.parlay.findUniqueOrThrow({
        where: { id: ticket.id },
        include: { legs: true },
      });
      assert.equal(fresh.outcome, "VOID");
      assert.equal(fresh.legs[0]!.outcome, "VOID");
      const result = await tx.play.updateMany({
        where: { id: leg.id, outcome: "PENDING" },
        data: { outcome: "WIN" },
      });
      assert.equal(result.count, 0);
    });
    try {
      await attempting.promise;
      await new Promise((resolve) => setTimeout(resolve, 150));
      assert.equal(
        secondAcquired,
        false,
        "competing settlement must wait for the ticket lock",
      );
    } finally {
      release.resolve();
      await Promise.all([manual, automatic]);
    }
    assert.equal(secondAcquired, true);
    console.log(
      "PASS: competing grading transactions serialize and preserve manual outcomes",
    );
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
