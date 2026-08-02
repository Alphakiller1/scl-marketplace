CREATE TABLE "PlayPackage" (
    "playId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayPackage_pkey" PRIMARY KEY ("playId", "packageId")
);

ALTER TABLE "Play" ADD COLUMN "eventLabel" TEXT;

CREATE TABLE "ParlayPackage" (
    "parlayId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParlayPackage_pkey" PRIMARY KEY ("parlayId", "packageId")
);

CREATE INDEX "PlayPackage_packageId_createdAt_idx"
ON "PlayPackage"("packageId", "createdAt");

CREATE INDEX "ParlayPackage_packageId_createdAt_idx"
ON "ParlayPackage"("packageId", "createdAt");

ALTER TABLE "PlayPackage"
ADD CONSTRAINT "PlayPackage_playId_fkey"
FOREIGN KEY ("playId") REFERENCES "Play"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlayPackage"
ADD CONSTRAINT "PlayPackage_packageId_fkey"
FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParlayPackage"
ADD CONSTRAINT "ParlayPackage_parlayId_fkey"
FOREIGN KEY ("parlayId") REFERENCES "Parlay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParlayPackage"
ADD CONSTRAINT "ParlayPackage_packageId_fkey"
FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;
