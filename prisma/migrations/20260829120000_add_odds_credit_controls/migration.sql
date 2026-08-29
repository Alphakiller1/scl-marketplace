-- Owner-managed Odds API controls, execution history, and immutable audit trail.
CREATE TABLE scl."OddsControlConfig" (
  "id" TEXT NOT NULL DEFAULT 'primary',
  "managedSchedulingEnabled" BOOLEAN NOT NULL DEFAULT false,
  "paused" BOOLEAN NOT NULL DEFAULT false,
  "dailyCreditLimit" INTEGER NOT NULL DEFAULT 2000,
  "weeklyCreditLimit" INTEGER NOT NULL DEFAULT 10000,
  "monthlyCreditLimit" INTEGER NOT NULL DEFAULT 20000,
  "warningPercent" INTEGER NOT NULL DEFAULT 70,
  "reserveCredits" INTEGER NOT NULL DEFAULT 1000,
  "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OddsControlConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE scl."OddsSportControl" (
  "id" TEXT NOT NULL,
  "sport" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "surfaceEnabled" BOOLEAN NOT NULL DEFAULT true,
  "expandedEnabled" BOOLEAN NOT NULL DEFAULT false,
  "surfaceMarkets" TEXT[] NOT NULL DEFAULT ARRAY['h2h', 'spreads', 'totals']::TEXT[],
  "expandedMarkets" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "leagues" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "surfaceCadenceMinutes" INTEGER NOT NULL DEFAULT 240,
  "expandedCadenceMinutes" INTEGER NOT NULL DEFAULT 360,
  "maxEventsPerRun" INTEGER NOT NULL DEFAULT 20,
  "nextSurfaceRunAt" TIMESTAMP(3),
  "nextExpandedRunAt" TIMESTAMP(3),
  "lastSurfaceRunAt" TIMESTAMP(3),
  "lastExpandedRunAt" TIMESTAMP(3),
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OddsSportControl_pkey" PRIMARY KEY ("id")
);

CREATE TABLE scl."OddsApiRun" (
  "id" TEXT NOT NULL,
  "sport" TEXT NOT NULL,
  "tier" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "estimatedCredits" INTEGER NOT NULL DEFAULT 0,
  "reservedCredits" INTEGER NOT NULL DEFAULT 0,
  "credits" INTEGER NOT NULL DEFAULT 0,
  "remaining" INTEGER,
  "markets" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "leagues" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "details" JSONB,
  "error" TEXT,
  "triggeredById" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "OddsApiRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE scl."OddsControlAuditEvent" (
  "id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "target" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OddsControlAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OddsSportControl_sport_key" ON scl."OddsSportControl"("sport");
CREATE INDEX "OddsSportControl_enabled_nextSurfaceRunAt_idx" ON scl."OddsSportControl"("enabled", "nextSurfaceRunAt");
CREATE INDEX "OddsSportControl_enabled_nextExpandedRunAt_idx" ON scl."OddsSportControl"("enabled", "nextExpandedRunAt");
CREATE INDEX "OddsApiRun_startedAt_idx" ON scl."OddsApiRun"("startedAt");
CREATE INDEX "OddsApiRun_sport_startedAt_idx" ON scl."OddsApiRun"("sport", "startedAt");
CREATE INDEX "OddsApiRun_status_startedAt_idx" ON scl."OddsApiRun"("status", "startedAt");
CREATE INDEX "OddsControlAuditEvent_createdAt_idx" ON scl."OddsControlAuditEvent"("createdAt");
CREATE INDEX "OddsControlAuditEvent_actorId_createdAt_idx" ON scl."OddsControlAuditEvent"("actorId", "createdAt");

ALTER TABLE scl."OddsControlConfig"
  ADD CONSTRAINT "OddsControlConfig_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES scl."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE scl."OddsSportControl"
  ADD CONSTRAINT "OddsSportControl_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES scl."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE scl."OddsApiRun"
  ADD CONSTRAINT "OddsApiRun_triggeredById_fkey"
  FOREIGN KEY ("triggeredById") REFERENCES scl."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE scl."OddsControlAuditEvent"
  ADD CONSTRAINT "OddsControlAuditEvent_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES scl."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO scl."OddsControlConfig" ("id", "updatedAt")
VALUES ('primary', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
