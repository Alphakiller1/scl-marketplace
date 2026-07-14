-- M4 / v1.1: capture book on straight plays (additive, nullable)

ALTER TABLE "Play"
ADD COLUMN "book" TEXT;
