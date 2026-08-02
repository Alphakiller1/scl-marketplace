-- Refund policy is managed and versioned alongside the existing policy documents.
ALTER TYPE "PolicySlug" ADD VALUE IF NOT EXISTS 'REFUND';
