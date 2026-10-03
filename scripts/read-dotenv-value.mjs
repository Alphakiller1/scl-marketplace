import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

function decodeValue(raw) {
  const value = raw.trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    return JSON.parse(value);
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  return value;
}

export function readDotenvValue(contents, key) {
  for (const line of contents.split(/\r?\n/)) {
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (match?.[1] === key) return decodeValue(match[2]);
  }
  return "";
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [, , path, key] = process.argv;
  if (!path || !key) {
    process.stderr.write("Usage: read-dotenv-value.mjs <path> <key>\n");
    process.exit(2);
  }
  process.stdout.write(readDotenvValue(readFileSync(path, "utf8"), key));
}
