import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import { PrismaClient } from "@prisma/client";

import {
  inspectLegacyPackageLineage,
  inspectLegacyPackageIntegrity,
  loadLegacyPackageIntegrityRows,
  reconcileLegacyPackageSource,
} from "../src/lib/legacy-package-integrity";
import { legacyPackagesImportSchema } from "../src/lib/schemas/legacy-packages.schema";
import { ensureSupabaseDatabaseEnvAliases } from "../src/lib/supabase-config";

const envFile = process.env.PACKAGE_AUDIT_ENV_FILE?.trim();
if (envFile) process.loadEnvFile(envFile);
ensureSupabaseDatabaseEnvAliases();

const prisma = new PrismaClient();

async function main() {
  const rows = await loadLegacyPackageIntegrityRows(prisma);
  const integrity = inspectLegacyPackageIntegrity(rows);
  const lifecycleEvents = await prisma.packageAuditEvent.findMany({
    where: {
      capper: { isLegacy: true },
      action: { in: ["CREATED", "DELETED"] },
    },
    select: { action: true },
  });
  const lineage = inspectLegacyPackageLineage(rows.length, lifecycleEvents);
  const recentLegacyPackageAudits =
    integrity.errors.length || lineage.errors.length
      ? await prisma.packageAuditEvent.findMany({
          where: { capper: { isLegacy: true } },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            action: true,
            summary: true,
            createdAt: true,
            package: {
              select: {
                id: true,
                title: true,
                affiliateProvider: true,
                checkoutUrl: true,
              },
            },
            capper: { select: { user: { select: { username: true } } } },
          },
        })
      : [];
  const sourceArg = process.argv[2];
  let sourceReconciliation:
    | { source: string; matched: number; errors: string[] }
    | undefined;

  if (sourceArg) {
    const sourcePath = path.resolve(process.cwd(), sourceArg);
    const source = legacyPackagesImportSchema.parse(
      JSON.parse(readFileSync(sourcePath, "utf8")),
    );
    const reconciled = reconcileLegacyPackageSource(source, rows);
    sourceReconciliation = {
      source: path.basename(sourcePath),
      matched: reconciled.matched,
      errors: reconciled.errors,
    };
  }

  const errors = [
    ...integrity.errors,
    ...lineage.errors,
    ...(sourceReconciliation?.errors ?? []),
  ];
  console.log(
    JSON.stringify(
      {
        ok: errors.length === 0,
        stats: integrity.stats,
        lineage: {
          sourceTotal: lineage.sourceTotal,
          created: lineage.created,
          deleted: lineage.deleted,
          expectedTotal: lineage.expectedTotal,
          currentTotal: lineage.currentTotal,
        },
        warnings: integrity.warnings,
        errors,
        sourceReconciliation,
        diagnostics: errors.length
          ? {
              whopPackages: rows
                .filter((row) => row.affiliateProvider === "WHOP")
                .map((row) => ({
                  id: row.id,
                  username: row.username,
                  title: row.title,
                  active: row.isActive,
                  checkoutUrl: row.checkoutUrl,
                })),
              inactivePackages: rows
                .filter((row) => !row.isActive)
                .map((row) => ({
                  id: row.id,
                  username: row.username,
                  title: row.title,
                  provider: row.affiliateProvider,
                  checkoutUrl: row.checkoutUrl,
                })),
              recentLegacyPackageAudits,
            }
          : undefined,
      },
      null,
      2,
    ),
  );
  if (errors.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("[package-integrity] audit failed", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
