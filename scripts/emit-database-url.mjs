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

/**
 * Name the shape of a value without echoing any of it.
 *
 * Printing even the first few characters is useless here as well as risky:
 * Actions masks anything resembling a registered secret, so the diagnostic came
 * back as `starts with "[SENSITI"` and said nothing at all. A scheme name and a
 * length are enough to tell a Prisma Accelerate URL from a truncated one, and
 * neither is a credential.
 */
export function describeUrl(value) {
  const scheme = value.match(/^([a-z][a-z0-9+.-]*):\/\//i)?.[1];
  return `${scheme ? `${scheme}:// scheme` : "no scheme"}, ${value.length} chars`;
}

/**
 * The Postgres URL a plain Prisma Client can open.
 *
 * DATABASE_URL is not always one. An app fronted by Prisma Accelerate holds a
 * `prisma://` URL there and keeps the real Postgres string in DIRECT_URL, and
 * Accelerate is exactly the setup a script like this cannot use: it needs the
 * database itself. So the choice is by shape, not by name.
 */
export function selectPostgresUrl(found) {
  for (const name of ["DATABASE_URL", "DIRECT_URL"]) {
    const hit = found.find(
      ([key, value]) => key === name && isPostgresUrl(value),
    );
    if (hit) return { name: hit[0], value: hit[1] };
  }
  return null;
}

function main() {
  const file = process.env.FILE;
  const githubEnv = process.env.GITHUB_ENV;
  if (!file) throw new Error("FILE is required");
  if (!githubEnv) throw new Error("GITHUB_ENV is required");

  const found = readConnectionVars(readFileSync(file, "utf8"));
  if (found.length === 0) throw new Error(`${file} carried no DATABASE_URL`);

  const selected = selectPostgresUrl(found);
  if (!selected) {
    const shapes = found
      .map(([name, value]) => `${name} (${describeUrl(value)})`)
      .join(", ");
    throw new Error(`${file} carried no Postgres URL — found ${shapes}`);
  }

  appendFileSync(githubEnv, `DATABASE_URL=${selected.value}\n`);
  const direct = found.find(
    ([name, value]) => name === "DIRECT_URL" && isPostgresUrl(value),
  );
  if (direct) appendFileSync(githubEnv, `DIRECT_URL=${direct[1]}\n`);
  console.log(
    `resolved DATABASE_URL from ${selected.name} in ${file} (${describeUrl(selected.value)})`,
  );
}

if (process.env.FILE) main();
