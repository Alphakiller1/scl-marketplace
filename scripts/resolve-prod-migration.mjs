import { spawnSync } from 'node:child_process';

const migrationName = '20260719000000_ci_catchup_istest_needsreview';

const result =
  process.platform === 'win32'
    ? spawnSync(
        'cmd.exe',
        [
          '/d',
          '/s',
          '/c',
          `npm exec -- prisma migrate resolve --applied ${migrationName}`,
        ],
        {
          encoding: 'utf8',
          stdio: 'pipe',
        },
      )
    : spawnSync(
        'npm',
        ['exec', '--', 'prisma', 'migrate', 'resolve', '--applied', migrationName],
        {
          encoding: 'utf8',
          stdio: 'pipe',
        },
      );

const output = `${result.stdout || ''}${result.stderr || ''}`;

if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exit(1);
}

if (result.status !== 0 && !output.includes('P3008')) {
  process.stderr.write(output);
  process.exit(result.status || 1);
}
