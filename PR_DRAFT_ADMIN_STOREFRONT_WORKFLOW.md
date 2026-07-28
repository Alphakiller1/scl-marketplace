# PR Draft: Admin storefront workflow — feature/admin-storefront-workflow

This branch implements persistent workflow tracking for storefront onboarding and admin review flows.

Summary
- Adds new scalar fields to StoreConnection to support admin workflow and at-a-glance UI:
  - affiliateAcceptedAt: DateTime? — when admin accepted the affiliate relationship
  - lastImportedAt: DateTime? — last package import/sync
  - packageCount: Int @default(0) — cached package count for fast listing
  - affiliatePercent: Float? — optional affiliate % captured from provider (import)
  - requiresAttention: Boolean @default(false) — admin-facing flag for triage
- Adds a SQL migration file under prisma/migrations/20260728021529_add_storeconnection_workflow/migration.sql
- Server:
  - Updated admin actions and package sync logic to set packageCount, affiliateAcceptedAt, lastImportedAt, requiresAttention and to emit PACKAGE_SYNC review events when readiness changes.
  - list/get storefront queries are wired to return these fields (Prisma find/includes already return scalars).
- UI:
  - New admin list item component showing packageCount, affiliatePercent, and a visual ring when requiresAttention.
  - Admin store setup list wired to use the new list item.

What to run locally / CI
1. Apply the migration to your development database and regenerate the Prisma client:

   # Ensure DATABASE_URL points to your dev DB and includes the `?schema=scl` if applicable.
   npx prisma migrate dev --name add_storeconnection_workflow
   npx prisma generate

   Alternatively, in CI/production use `prisma migrate deploy` (the SQL migration file is included).

2. Install deps and run tests:

   npm install
   npm run typecheck
   npm run lint
   npm test

3. Start dev server and verify admin list at /admin/store-setup and that the new columns appear.

Notes / migration strategy
- The branch includes a SQL migration file; CI should run `prisma migrate deploy` during deployment. If you prefer a push-only workflow, run `npx prisma db push` instead and skip the migration files, but this repo's CI expects migrations to exist.
- The runtime code expects the Prisma client to include the new StoreConnection fields; after applying the migration run `npx prisma generate`.

Open questions / follow-ups
- Capture of affiliatePercent: where to extract it from provider import; currently the field is present for future import worker to populate.
- Feature flag: the admin UI changes are on this branch — recommend gating behind a feature flag in production until QA completes.

Checklist for PR
- [ ] Dev migration applied and Prisma client regenerated
- [ ] Unit/API tests added and passing
- [ ] Smoke e2e for admin list -> open -> action
- [ ] Changelog & deploy notes included (this file)

