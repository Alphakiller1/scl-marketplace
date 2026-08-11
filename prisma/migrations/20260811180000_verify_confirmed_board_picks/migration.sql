-- Confirmed manual board selections were previously downgraded whenever the
-- submit action intentionally skipped a second live provider request. Manual
-- entry is disabled, and selectedOddsAmerican is populated only by the board
-- submission path, so promote those existing pre-game records to VERIFIED.
UPDATE scl."Play"
SET
  "oddsVerified" = TRUE,
  "verificationTier" = 'VERIFIED'
WHERE "source" = 'MANUAL'
  AND "loggedPreGame" = TRUE
  AND "eventId" IS NOT NULL
  AND BTRIM("eventId") <> ''
  AND "eventStartsAt" IS NOT NULL
  AND "side" IS NOT NULL
  AND BTRIM("side") <> ''
  AND "selectedOddsAmerican" IS NOT NULL
  AND "verificationTier" = 'SELF_REPORTED';
