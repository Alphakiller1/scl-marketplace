import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  LEAGUE_PICK_DEMAND_WINDOW_DAYS,
  summarizeLeaguePickDemand,
} from "@/lib/odds-demand";

const read = (relative: string) =>
  fs.readFileSync(path.join(process.cwd(), relative), "utf8");

test("league demand counts unique cappers and every committed pick", () => {
  const demand = summarizeLeaguePickDemand([
    {
      sport: "SOCCER",
      league: "EPL",
      capperId: "capper-a",
      pickCount: 4,
      lastPickAt: new Date("2026-08-29T12:00:00Z"),
    },
    {
      sport: "soccer",
      league: "epl",
      capperId: "capper-b",
      pickCount: 2,
      lastPickAt: new Date("2026-08-30T12:00:00Z"),
    },
    {
      sport: "NFL",
      league: null,
      capperId: "capper-a",
      pickCount: 8,
      lastPickAt: new Date("2026-08-28T12:00:00Z"),
    },
  ]);

  assert.equal(LEAGUE_PICK_DEMAND_WINDOW_DAYS, 30);
  assert.deepEqual(demand, [
    {
      key: "SOCCER:EPL",
      sport: "SOCCER",
      league: "EPL",
      activeCappers: 2,
      picks: 6,
      lastPickAt: "2026-08-30T12:00:00.000Z",
    },
    {
      key: "NFL:NFL",
      sport: "NFL",
      league: "NFL",
      activeCappers: 1,
      picks: 8,
      lastPickAt: "2026-08-28T12:00:00.000Z",
    },
  ]);
});

test("league demand ranks owner allocation signal by cappers before volume", () => {
  const demand = summarizeLeaguePickDemand([
    {
      sport: "MLB",
      league: "MLB",
      capperId: "one",
      pickCount: 100,
      lastPickAt: new Date("2026-08-30T12:00:00Z"),
    },
    ...["one", "two", "three"].map((capperId) => ({
      sport: "WNBA",
      league: "WNBA",
      capperId,
      pickCount: 1,
      lastPickAt: new Date("2026-08-30T12:00:00Z"),
    })),
  ]);

  assert.equal(demand[0]?.league, "WNBA");
  assert.equal(demand[0]?.activeCappers, 3);
  assert.equal(demand[1]?.league, "MLB");
});

test("admin demand query excludes drafts and non-production accounts", () => {
  const query = read("src/lib/queries/odds-control.ts");
  const page = read("src/app/(admin)/admin/odds/page.tsx");
  const component = read("src/components/scl/admin-league-pick-demand.tsx");
  const schema = read("prisma/schema.prisma");
  const migration = read(
    "prisma/migrations/20260830160000_league_pick_demand_index/migration.sql",
  );

  assert.match(query, /by: \["sport", "league", "capperId"\]/);
  assert.match(query, /status: "COMMITTED"/);
  assert.match(query, /role: "CAPPER"/);
  assert.match(query, /accountStatus: "ACTIVE"/);
  assert.match(query, /isTest: false/);
  assert.match(page, /AdminLeaguePickDemand/);
  assert.match(component, /League pick demand/);
  assert.match(component, /Active cappers/);
  assert.match(component, /Pick volume/);
  assert.match(schema, /@@index\(\[status, createdAt\]\)/);
  assert.match(migration, /Play_status_createdAt_idx/);
});
