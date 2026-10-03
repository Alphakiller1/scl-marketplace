/** Add SCL's explicit Prisma schema without exposing or rebuilding credentials. */
export function withSclSchema(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Database URL is invalid");
  }
  if (!/^postgres(ql)?:$/.test(url.protocol)) {
    throw new Error("Database URL must use postgresql:// or postgres://");
  }
  url.searchParams.set("schema", "scl");
  return url.toString();
}

// The workflow passes the secret through the environment and captures stdout.
// Never log it: stdout becomes the replacement Vercel secret value.
if (process.env.NORMALIZE_SCL_DATABASE_URL) {
  process.stdout.write(
    withSclSchema(process.env.NORMALIZE_SCL_DATABASE_URL.trim()),
  );
}
