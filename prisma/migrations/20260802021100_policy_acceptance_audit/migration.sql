-- Preserve the exact required-policy versions and consent statement accepted by each user.
-- Columns are nullable so historical TermsAcceptance rows remain valid and trigger re-consent
-- through the new policy-bundle version gate.
ALTER TABLE "TermsAcceptance"
  ADD COLUMN "termsVersion" TEXT,
  ADD COLUMN "privacyVersion" TEXT,
  ADD COLUMN "responsibleGamingVersion" TEXT,
  ADD COLUMN "refundVersion" TEXT,
  ADD COLUMN "consentTextVersion" TEXT,
  ADD COLUMN "acceptanceSource" TEXT;
