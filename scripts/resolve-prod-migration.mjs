/**
 * Pre-deploy script: marks all manually-applied migrations as resolved so that
 * `prisma migrate deploy` only needs to apply genuinely new migrations.
 *
 * Each migration is resolved individually via `prisma migrate resolve --applied`.
 * Already-resolved migrations return P3008 (safe to ignore).
 * Remove a migration name from this list once it is cleanly in the DB history.
 */
import { spawnSync } from 'node:child_process';

// All migrations applied manually to production before Prisma migration tracking.
// GradeJobRun (20260728160025) is intentionally omitted — it should be applied fresh.
const MANUAL_MIGRATIONS = [
  '20260626071410_init',
  '20260626074100_enrich_capper_profile',
  '20260628150000_add_profile_banner',
  '20260628170000_add_account_trust',
  '20260628193000_add_default_storefront',
  '20260714180000_add_capper_profile_books',
  '20260714193000_add_play_book',
  '20260714220000_add_play_odds_movement',
  '20260717170000_store_connections_m3',
  '20260717210000_package_promo_sort',
  '20260719000000_ci_catchup_istest_needsreview',
  '20260726180000_admin_policy_documents',
  '20260726210000_admin_grading_corrections',
  '20260726233000_storefront_review_events',
  '20260728033616_add_storeconnection_workflow',
];

let anyFailed = false;

for (const migration of MANUAL_MIGRATIONS) {
  process.stdout.write(`  resolving ${migration} ... `);

  const args = ['exec', '--', 'prisma', 'migrate', 'resolve', '--applied', migration];
  const result =
    process.platform === 'win32'
      ? spawnSync('cmd.exe', ['/d', '/s', '/c', `npm ${args.join(' ')}`], {
          encoding: 'utf8',
          stdio: 'pipe',
        })
      : spawnSync('npm', args, { encoding: 'utf8', stdio: 'pipe' });

  const output = `${result.stdout || ''}${result.stderr || ''}`;

  if (result.error) {
    process.stderr.write(`ERROR: ${result.error.message}\n`);
    anyFailed = true;
    continue;
  }

  // P3008 = migration already applied (idempotent — safe to ignore)
  if (result.status !== 0 && !output.includes('P3008') && !output.includes('already been applied')) {
    process.stderr.write(`FAILED (exit ${result.status}):\n${output}\n`);
    anyFailed = true;
  } else {
    process.stdout.write('OK\n');
  }
}

if (anyFailed) {
  process.stderr.write('\nSome migrations failed to resolve. Aborting build.\n');
  process.exit(1);
}

process.stdout.write('All migrations resolved.\n');