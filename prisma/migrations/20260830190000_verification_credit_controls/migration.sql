-- Owner controls for true per-event verification requests. Expanded-board
-- population is accounted as board usage separately.
ALTER TABLE scl."OddsControlConfig"
  ADD COLUMN IF NOT EXISTS "verificationEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "verificationDailyRequestLimit" INTEGER NOT NULL DEFAULT 250,
  ADD COLUMN IF NOT EXISTS "verificationDailyCreditLimit" INTEGER NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS "verificationMaxCreditsPerRequest" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS "verificationCacheMinutes" INTEGER NOT NULL DEFAULT 30;

ALTER TABLE scl."OddsControlConfig"
  ADD CONSTRAINT "OddsControlConfig_verificationRequestLimit_check"
    CHECK ("verificationDailyRequestLimit" BETWEEN 1 AND 100000),
  ADD CONSTRAINT "OddsControlConfig_verificationCreditLimit_check"
    CHECK ("verificationDailyCreditLimit" BETWEEN 1 AND 1000000),
  ADD CONSTRAINT "OddsControlConfig_verificationPerRequest_check"
    CHECK ("verificationMaxCreditsPerRequest" BETWEEN 1 AND 100),
  ADD CONSTRAINT "OddsControlConfig_verificationCache_check"
    CHECK ("verificationCacheMinutes" BETWEEN 10 AND 1440);
