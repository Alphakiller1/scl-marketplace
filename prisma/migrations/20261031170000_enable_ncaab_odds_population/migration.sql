-- Launch NCAAB on both the shared board and the two requested expanded
-- full-game ladders. The control row may already exist as disabled because
-- every dashboard sport was persisted before college basketball went live.
INSERT INTO scl."OddsSportControl" (
  "id",
  "sport",
  "enabled",
  "surfaceEnabled",
  "expandedEnabled",
  "surfaceMarkets",
  "expandedMarkets",
  "maxEventsPerRun",
  "nextSurfaceRunAt",
  "nextExpandedRunAt",
  "updatedAt"
)
VALUES (
  'ncaab-launch-2026-10-31',
  'NCAAB',
  true,
  true,
  true,
  ARRAY['h2h', 'spreads', 'totals']::TEXT[],
  ARRAY['alternate_spreads', 'alternate_totals']::TEXT[],
  200,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("sport") DO UPDATE SET
  "enabled" = true,
  "surfaceEnabled" = true,
  "expandedEnabled" = true,
  "surfaceMarkets" = ARRAY['h2h', 'spreads', 'totals']::TEXT[],
  "expandedMarkets" = ARRAY['alternate_spreads', 'alternate_totals']::TEXT[],
  "maxEventsPerRun" = 200,
  "nextSurfaceRunAt" = COALESCE("OddsSportControl"."nextSurfaceRunAt", CURRENT_TIMESTAMP),
  "nextExpandedRunAt" = COALESCE("OddsSportControl"."nextExpandedRunAt", CURRENT_TIMESTAMP),
  "updatedAt" = CURRENT_TIMESTAMP;
