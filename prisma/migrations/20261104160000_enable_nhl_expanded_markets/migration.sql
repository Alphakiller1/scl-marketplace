-- Owner-requested NHL launch. Provider-supported skater/goalie markets only;
-- goals allowed and hits have no current Odds API market key.
INSERT INTO scl."OddsSportControl" (
  "id", "sport", "enabled", "surfaceEnabled", "expandedEnabled",
  "surfaceMarkets", "expandedMarkets", "maxEventsPerRun",
  "nextSurfaceRunAt", "nextExpandedRunAt", "updatedAt"
)
VALUES (
  'nhl-launch-2026-11-04', 'NHL', true, true, true,
  ARRAY['h2h', 'spreads', 'totals']::TEXT[],
  ARRAY[
    'alternate_spreads', 'alternate_totals',
    'player_shots_on_goal', 'player_shots_on_goal_alternate',
    'player_goals', 'player_goals_alternate',
    'player_points', 'player_points_alternate',
    'player_assists', 'player_assists_alternate',
    'player_total_saves', 'player_total_saves_alternate',
    'player_blocked_shots', 'player_blocked_shots_alternate',
    'player_power_play_points', 'player_power_play_points_alternate',
    'player_faceoffs_won', 'player_faceoffs_won_alternate'
  ]::TEXT[],
  20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("sport") DO UPDATE SET
  "enabled" = true,
  "surfaceEnabled" = true,
  "expandedEnabled" = true,
  "expandedMarkets" = EXCLUDED."expandedMarkets",
  "nextSurfaceRunAt" = CURRENT_TIMESTAMP,
  "nextExpandedRunAt" = CURRENT_TIMESTAMP,
  "updatedAt" = CURRENT_TIMESTAMP;
