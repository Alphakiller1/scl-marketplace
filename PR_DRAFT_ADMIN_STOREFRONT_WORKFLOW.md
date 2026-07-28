# feat(admin): add storefront workflow status fields + admin listing enhancements

## Summary

This PR completes the admin storefront workflow feature by:
1. Adding new database fields to `StoreConnection` for tracking workflow status
2. Creating and applying a Prisma migration to support the new fields
3. Updating server-side queries and actions to handle workflow state
4. Enhancing the admin UI to display and filter by workflow status
5. Adding tests and a feature flag to gate the functionality

### Database Schema Changes

**New StoreConnection fields:**
- `affiliateAcceptedAt` (DateTime?) — timestamp when APPROVE action is taken
- `lastImportedAt` (DateTime?) — timestamp when packages are imported/synced
- `packageCount` (Int, default 0) — running count of packages on this connection
- `affiliatePercent` (Float?) — affiliate percentage from provider integration
- `requiresAttention` (Boolean, default false) — flag for items needing triage

**Migration:** `prisma/migrations/20260728033616_add_storeconnection_workflow`

### Server-Side Changes

**Queries (src/lib/queries/store.ts):**
- `listStoreConnections()` now accepts `requiresAttentionOnly` filter
- Results are sorted by `requiresAttention DESC` first, then by submission time
- New query: `countStoreConnectionsRequiringAttention()` for dashboard badge

**Actions (src/lib/actions/store.action.ts):**
- `adminUpdateStoreConnectionAction()` sets `affiliateAcceptedAt` on APPROVE
- Sets `requiresAttention = true` when transitioning to NEEDS_ACTION
- Sets `requiresAttention = false` implicitly for other transitions
- Updates `packageCount` and `lastImportedAt` on sync operations
- Synced fields persist to the database and are audited in `StorefrontReviewEvent`

### UI Enhancements

**Admin Store Setup List (src/app/(admin)/admin/store-setup/page.tsx):**
- New columns display `packageCount` and `affiliatePercent`
- Rows with `requiresAttention = true` are highlighted with `ring-2 ring-amber-400/30`
- New filter button "Needs attention" filters to show only items requiring triage
- Filter state is preserved in query params alongside provider filter

**Request Detail Panel:**
- Displays `packageCount`, `affiliatePercent`, `affiliateAcceptedAt`, and `lastImportedAt`
- Only shown when `packageCount > 0`

### Feature Flag

New environment variable `FEATURE_ADMIN_STOREFRONT_WORKFLOW` gates the functionality.
- Default: `""`  (disabled in production)
- Local dev: `"true"` (enabled for QA/testing)

To enable in production, set `FEATURE_ADMIN_STOREFRONT_WORKFLOW=true` in Vercel environment variables.

### Tests

**Unit tests (src/lib/storefront-review.test.ts):**
- Added `workflow transitions update new status fields correctly` test
- Verifies that APPROVE, REQUEST_CHANGES, and MARK_LIVE transitions route correctly
- Existing tests for transition logic remain unchanged and passing

**All tests passing:** 351/351 ✔

### Quality Checks

- ✅ `npm run typecheck` — no errors
- ✅ `npm run lint` — no new errors (2 pre-existing warnings unrelated)
- ✅ `npm run test` — 351 tests passing
- ✅ `npm run build` — production build successful

### How to Verify Locally

```bash
# Ensure .env has the feature flag enabled
export FEATURE_ADMIN_STOREFRONT_WORKFLOW="true"

# Apply migrations and regenerate Prisma client
npm run db:migrate

# Start dev server
npm run dev

# Navigate to /admin/store-setup to see the new workflow fields and filter
```

### Deployment Instructions

1. **Pre-deploy (CI/CD):**
   ```bash
   npx prisma migrate deploy  # Apply migration to production DB
   npx prisma generate        # Regenerate Prisma client
   ```

2. **Feature Flag (optional initially):**
   - Leave `FEATURE_ADMIN_STOREFRONT_WORKFLOW` unset or empty to keep feature hidden
   - Set to `"true"` in Vercel → Project Settings → Environment Variables when ready to enable

### Related Issues

Closes issue for admin storefront workflow feature completion.

### Checklist

- [x] Migration created and applied locally
- [x] Prisma client regenerated
- [x] Server queries return new workflow fields
- [x] Admin actions update workflow fields on state transitions
- [x] UI displays and filters by workflow status
- [x] Tests added and passing (351/351)
- [x] Typecheck passing
- [x] Lint passing
- [x] Build succeeding
- [x] Feature flag implemented and documented
- [x] `.env.example` updated with feature flag placeholder
