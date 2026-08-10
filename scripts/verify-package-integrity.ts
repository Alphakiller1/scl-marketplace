import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import { PrismaClient } from "@prisma/client";

import {
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

  const errors = [...integrity.errors, ...(sourceReconciliation?.errors ?? [])];
  console.log(
    JSON.stringify(
      {
        ok: errors.length === 0,
        stats: integrity.stats,
        warnings: integrity.warnings,
        errors,
        sourceReconciliation,
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
