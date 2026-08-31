import assert from "node:assert/strict";
import test from "node:test";

import { buildOddsOwnerPlaybook } from "@/lib/odds-control-playbook";
import { oddsControlPreset } from "@/lib/odds-control-presets";

test("owner playbook exports forecast, sport cadence, markets, and guardrails", () => {
  const preset = oddsControlPreset("balanced");
  const playbook = buildOddsOwnerPlaybook(
    { ...preset.config, sports: preset.sports },
    new Date("2026-08-31T12:00:00.000Z"),
  );

  assert.match(playbook, /Conservative modeled usage: 88,040 credits/);
  assert.match(playbook, /Provider allocation used for planning: 100,000/);
  assert.match(playbook, /Owner monthly hard limit: 100,000/);
  assert.match(playbook, /\| NFL \| Every 2 hours \| Every 6 hours \| 16 \|/);
  assert.match(
    playbook,
    /\| SOCCER \| Every 4 hours \| Every 4 hours \| 30 \|/,
  );
  assert.match(
    playbook,
    /Expanded markets: alternate spreads, alternate totals/,
  );
  assert.match(playbook, /Daily verification credits: 550/);
  assert.match(playbook, /Scheduling status: Preview only/);
  assert.match(playbook, /Generated: 2026-08-31T12:00:00.000Z/);
});
