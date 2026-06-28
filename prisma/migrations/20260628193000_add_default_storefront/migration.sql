-- Every capper has a public storefront presentation. Null title/description
-- values use the application defaults until the capper customizes them.
ALTER TABLE "CapperProfile"
ADD COLUMN "storefrontTitle" TEXT,
ADD COLUMN "storefrontDescription" TEXT,
ADD COLUMN "storefrontEnabled" BOOLEAN NOT NULL DEFAULT true;
