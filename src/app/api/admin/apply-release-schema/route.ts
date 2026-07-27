import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const expectedBranch = "fix/admin-access-phase0";

function isReleasePreview() {
  return (
    process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === expectedBranch
  );
}

function unavailableResponse() {
  return Response.json({ error: "Not found" }, { status: 404 });
}

export async function GET() {
  await requireAdmin();

  if (!isReleasePreview()) {
    return unavailableResponse();
  }

  return new Response(
    `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>SCL release schema patch</title></head>
  <body>
    <main>
      <h1>SCL release schema patch</h1>
      <p>This admin-only preview action applies the three additive release patches to the connected SCL schema.</p>
      <form method="post">
        <button type="submit">Apply release schema patch</button>
      </form>
    </main>
  </body>
</html>`,
    {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
      },
    },
  );
}

export async function POST() {
  const admin = await requireAdmin();

  if (!isReleasePreview()) {
    return unavailableResponse();
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const [connection] = await tx.$queryRaw<
        Array<{ currentSchema: string; userTable: string | null }>
      >`
        SELECT
          current_schema()::text AS "currentSchema",
          to_regclass('"User"')::text AS "userTable"
      `;

      if (connection?.currentSchema !== "scl" || !connection.userTable) {
        throw new Error(
          "Refusing release patch outside the populated scl schema",
        );
      }

      await tx.$executeRawUnsafe(`
        DO $$
        BEGIN
          CREATE TYPE "PolicySlug" AS ENUM (
            'TERMS',
            'PRIVACY',
            'DISCLAIMER',
            'RESPONSIBLE_GAMING'
          );
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END
        $$
      `);

      await tx.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PolicyDocument" (
          "slug" "PolicySlug" NOT NULL,
          "title" TEXT NOT NULL,
          "body" TEXT NOT NULL,
          "version" TEXT NOT NULL,
          "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedById" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "PolicyDocument_pkey" PRIMARY KEY ("slug"),
          CONSTRAINT "PolicyDocument_updatedById_fkey"
            FOREIGN KEY ("updatedById") REFERENCES "User"("id")
            ON DELETE SET NULL ON UPDATE CASCADE
        )
      `);

      await tx.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PolicyDocumentRevision" (
          "id" TEXT NOT NULL,
          "slug" "PolicySlug" NOT NULL,
          "title" TEXT NOT NULL,
          "body" TEXT NOT NULL,
          "version" TEXT NOT NULL,
          "editedById" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "PolicyDocumentRevision_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "PolicyDocumentRevision_slug_fkey"
            FOREIGN KEY ("slug") REFERENCES "PolicyDocument"("slug")
            ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "PolicyDocumentRevision_editedById_fkey"
            FOREIGN KEY ("editedById") REFERENCES "User"("id")
            ON DELETE SET NULL ON UPDATE CASCADE
        )
      `);

      await tx.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "PolicyDocument_updatedById_idx"
          ON "PolicyDocument" ("updatedById")
      `);
      await tx.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "PolicyDocumentRevision_slug_createdAt_idx"
          ON "PolicyDocumentRevision" ("slug", "createdAt")
      `);
      await tx.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "PolicyDocumentRevision_editedById_idx"
          ON "PolicyDocumentRevision" ("editedById")
      `);

      await tx.$executeRawUnsafe(`
        ALTER TABLE "GradingAudit"
          ADD COLUMN IF NOT EXISTS "previousProfitUnits" DECIMAL(10, 2),
          ADD COLUMN IF NOT EXISTS "newProfitUnits" DECIMAL(10, 2)
      `);

      await tx.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ParlayGradingAudit" (
          "id" TEXT NOT NULL,
          "parlayId" TEXT NOT NULL,
          "previousOutcome" "Outcome" NOT NULL,
          "newOutcome" "Outcome" NOT NULL,
          "previousProfitUnits" DECIMAL(10, 2),
          "newProfitUnits" DECIMAL(10, 2),
          "source" "GradingSource" NOT NULL,
          "gradedById" TEXT,
          "reason" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "ParlayGradingAudit_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "ParlayGradingAudit_parlayId_fkey"
            FOREIGN KEY ("parlayId") REFERENCES "Parlay"("id")
            ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "ParlayGradingAudit_gradedById_fkey"
            FOREIGN KEY ("gradedById") REFERENCES "User"("id")
            ON DELETE SET NULL ON UPDATE CASCADE
        )
      `);

      await tx.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "ParlayGradingAudit_parlayId_createdAt_idx"
          ON "ParlayGradingAudit" ("parlayId", "createdAt")
      `);
      await tx.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "ParlayGradingAudit_gradedById_idx"
          ON "ParlayGradingAudit" ("gradedById")
      `);

      await tx.$executeRawUnsafe(`
        DO $$
        BEGIN
          CREATE TYPE "StorefrontReviewAction" AS ENUM (
            'APPROVED',
            'MARKED_LIVE',
            'CHANGES_REQUESTED',
            'SUSPENDED',
            'RESTORED',
            'NOTES_UPDATED',
            'PACKAGE_SYNC'
          );
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END
        $$
      `);

      await tx.$executeRawUnsafe(`
        ALTER TABLE "StoreConnection"
          ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
          ADD COLUMN IF NOT EXISTS "reviewedById" TEXT
      `);

      await tx.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "StorefrontReviewEvent" (
          "id" TEXT NOT NULL,
          "storeConnectionId" TEXT NOT NULL,
          "action" "StorefrontReviewAction" NOT NULL,
          "previousStatus" "StoreConnectionStatus" NOT NULL,
          "newStatus" "StoreConnectionStatus" NOT NULL,
          "reviewedById" TEXT NOT NULL,
          "reason" TEXT,
          "adminNotes" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "StorefrontReviewEvent_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "StorefrontReviewEvent_storeConnectionId_fkey"
            FOREIGN KEY ("storeConnectionId") REFERENCES "StoreConnection"("id")
            ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "StorefrontReviewEvent_reviewedById_fkey"
            FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE
        )
      `);

      await tx.$executeRawUnsafe(`
        DO $$
        BEGIN
          ALTER TABLE "StoreConnection"
            ADD CONSTRAINT "StoreConnection_reviewedById_fkey"
            FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END
        $$
      `);

      await tx.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "StoreConnection_reviewedById_idx"
          ON "StoreConnection" ("reviewedById")
      `);
      await tx.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "StorefrontReviewEvent_storeConnectionId_createdAt_idx"
          ON "StorefrontReviewEvent" ("storeConnectionId", "createdAt")
      `);
      await tx.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "StorefrontReviewEvent_reviewedById_idx"
          ON "StorefrontReviewEvent" ("reviewedById")
      `);

      const [verification] = await tx.$queryRaw<
        Array<{
          gradingColumns: bigint;
          parlayAuditTable: string | null;
          policyDocumentTable: string | null;
          policyRevisionTable: string | null;
          storefrontEventTable: string | null;
          storefrontReviewColumns: bigint;
        }>
      >`
        SELECT
          (
            SELECT COUNT(*)
            FROM information_schema.columns
            WHERE table_schema = 'scl'
              AND table_name = 'GradingAudit'
              AND column_name IN ('previousProfitUnits', 'newProfitUnits')
          ) AS "gradingColumns",
          to_regclass('"ParlayGradingAudit"')::text AS "parlayAuditTable",
          to_regclass('"PolicyDocument"')::text AS "policyDocumentTable",
          to_regclass('"PolicyDocumentRevision"')::text AS "policyRevisionTable",
          to_regclass('"StorefrontReviewEvent"')::text AS "storefrontEventTable",
          (
            SELECT COUNT(*)
            FROM information_schema.columns
            WHERE table_schema = 'scl'
              AND table_name = 'StoreConnection'
              AND column_name IN ('reviewedAt', 'reviewedById')
          ) AS "storefrontReviewColumns"
      `;

      if (
        Number(verification?.gradingColumns) !== 2 ||
        Number(verification.storefrontReviewColumns) !== 2 ||
        !verification.parlayAuditTable ||
        !verification.policyDocumentTable ||
        !verification.policyRevisionTable ||
        !verification.storefrontEventTable
      ) {
        throw new Error("Release schema verification failed");
      }

      return verification;
    },
    { maxWait: 5_000, timeout: 30_000 },
  );

  return Response.json({
    appliedBy: admin.id,
    status: "release schema patch applied and verified",
    verification: {
      gradingColumns: Number(result.gradingColumns),
      parlayAuditTable: result.parlayAuditTable,
      policyDocumentTable: result.policyDocumentTable,
      policyRevisionTable: result.policyRevisionTable,
      storefrontEventTable: result.storefrontEventTable,
      storefrontReviewColumns: Number(result.storefrontReviewColumns),
    },
  });
}
