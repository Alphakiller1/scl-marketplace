/**
 * Copy DATABASE_URL / DIRECT_URL out of a Vercel-pulled env file into
 * $GITHUB_ENV, quotes stripped.
 *
 * A file rather than an inline `node -e` in the workflow: the value can contain
 * every character a shell treats specially, and the inline form has to be
 * quoted through YAML, then bash, then JavaScript. Getting that wrong does not
 * fail loudly — it exports a truncated connection string.
 */
import { appendFileSync, readFileSync } from "node:fs";

/**
 * Strip every layer of wrapping quotes.
 *
 * One pass is not enough. The value reaches Vercel through a sync workflow that
 * quotes it, and `vercel pull` quotes it again on the way out, so the file
 * holds `DATABASE_URL="\"postgresql://…\""`. Removing a single layer leaves a
 * leading quote, and Prisma rejects it with "the URL must start with the
 * protocol postgresql://" — which reads like a bad secret rather than a
 * parsing bug.
 */
export function unquote(raw) {
  let value = raw.trim();
  while (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

/** Postgres connection strings only — anything else is a resolution failure. */
export function isPostgresUrl(value) {
  return /^postgres(ql)?:\/\//.test(value);
}

export function readConnectionVars(text) {
  const found = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(
      /^\s*(?:export\s+)?(DATABASE_URL|DIRECT_URL)=(.*)$/,
    );
    if (!match) continue;
    const value = unquote(match[2]);
    if (value) found.push([match[1], value]);
  }
  return found;
}

function main() {
  const file = process.env.FILE;
  const githubEnv = process.env.GITHUB_ENV;
  if (!file) throw new Error("FILE is required");
  if (!githubEnv) throw new Error("GITHUB_ENV is required");

  const found = readConnectionVars(readFileSync(file, "utf8"));
  if (found.length === 0) throw new Error(`${file} carried no DATABASE_URL`);

  for (const [name, value] of found) {
    if (!isPostgresUrl(value)) {
      // The scheme is the only part safe to echo — the rest is credentials.
      throw new Error(
        `${name} in ${file} is not a Postgres URL (starts with ${JSON.stringify(value.slice(0, 8))})`,
      );
    }
    appendFileSync(githubEnv, `${name}=${value}\n`);
  }
  console.log(`resolved ${found.length} connection variable(s) from ${file}`);
}

if (process.env.FILE) main();
