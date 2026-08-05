-- Audit trail when an admin emails a capper about storefront / affiliate setup.
ALTER TYPE scl."StorefrontReviewAction" ADD VALUE IF NOT EXISTS 'CAPPER_CONTACTED';
