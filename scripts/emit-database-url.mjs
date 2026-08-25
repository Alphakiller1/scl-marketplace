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

const file = process.env.FILE;
const githubEnv = process.env.GITHUB_ENV;
if (!file) throw new Error("FILE is required");
if (!githubEnv) throw new Error("GITHUB_ENV is required");

let wrote = 0;
for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
  const match = line.match(/^(DATABASE_URL|DIRECT_URL)=(.*)$/);
  if (!match) continue;
  let value = match[2].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (!value) continue;
  appendFileSync(githubEnv, `${match[1]}=${value}\n`);
  wrote += 1;
}

if (wrote === 0) throw new Error(`${file} carried no DATABASE_URL`);
console.log(`resolved ${wrote} connection variable(s) from ${file}`);
