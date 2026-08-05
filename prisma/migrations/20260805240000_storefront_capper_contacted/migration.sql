-- Audit trail when an admin emails a capper about storefront / affiliate setup.
ALTER TYPE "StorefrontReviewAction" ADD VALUE IF NOT EXISTS 'CAPPER_CONTACTED';
