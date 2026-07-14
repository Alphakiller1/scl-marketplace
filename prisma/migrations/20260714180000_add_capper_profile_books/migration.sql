-- M4 PR-1: CapperProfile.books (additive, expand/contract safe)

ALTER TABLE "CapperProfile"
ADD COLUMN "books" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
