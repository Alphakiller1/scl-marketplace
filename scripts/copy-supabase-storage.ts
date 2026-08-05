/**
 * Copy profile media between Supabase projects.
 *
 * `migrate-supabase-project.sh` dumps the `scl` Postgres schema, but avatars and
 * cover images live in Supabase **Storage** — object metadata sits in the
 * `storage` schema and the bytes sit in S3, so a `--schema=scl` dump does not
 * touch them. Without this step every profile image 404s after the cutover
 * while the database looks perfectly migrated.
 *
 * Dry-run by default. Nothing is uploaded without `--commit`.
 *
 *   OLD_SUPABASE_URL=... OLD_SUPABASE_SERVICE_ROLE_KEY=... \
 *   NEW_SUPABASE_URL=... NEW_SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/copy-supabase-storage.ts --commit
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BUCKET = process.env.SUPABASE_PROFILE_MEDIA_BUCKET ?? "scl-profile-media";
const COMMIT = process.argv.includes("--commit");

function client(urlVar: string, keyVar: string): SupabaseClient {
  const url = process.env[urlVar];
  const key = process.env[keyVar];
  if (!url || !key) {
    console.error(`✖ ${urlVar} and ${keyVar} must both be set.`);
    process.exit(1);
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Storage `list` is a single directory level and caps at 100 entries by default,
 * so walk recursively and page explicitly. A flat one-shot list silently returns
 * a partial set, which would look like a clean copy while dropping files.
 */
async function listAll(
  supabase: SupabaseClient,
  prefix = "",
): Promise<string[]> {
  const found: string[] = [];
  const PAGE = 100;
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: PAGE, offset });
    if (error) throw new Error(`list ${prefix || "/"}: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Folders come back with a null id.
      if (entry.id === null) found.push(...(await listAll(supabase, path)));
      else found.push(path);
    }

    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return found;
}

async function main() {
  const from = client("OLD_SUPABASE_URL", "OLD_SUPABASE_SERVICE_ROLE_KEY");
  const to = client("NEW_SUPABASE_URL", "NEW_SUPABASE_SERVICE_ROLE_KEY");

  console.log(`\n${COMMIT ? "COMMIT" : "DRY RUN"} — bucket "${BUCKET}"\n`);

  const paths = await listAll(from);
  console.log(`Found ${paths.length} objects in the source bucket.`);
  if (paths.length === 0) {
    console.log("Nothing to copy.");
    return;
  }

  if (COMMIT) {
    // Match the app's own bucket setup (see ensureProfileMediaBucket): profile
    // media is served publicly, so a private bucket would break every image.
    const { error } = await to.storage.createBucket(BUCKET, { public: true });
    if (error && !/already exists/i.test(error.message)) {
      console.error(`✖ Could not create bucket: ${error.message}`);
      process.exit(1);
    }
  }

  let copied = 0;
  let failed = 0;

  for (const path of paths) {
    if (!COMMIT) {
      console.log(`  would copy  ${path}`);
      continue;
    }

    const { data, error } = await from.storage.from(BUCKET).download(path);
    if (error || !data) {
      console.error(`  FAIL download ${path}: ${error?.message}`);
      failed += 1;
      continue;
    }

    const body = Buffer.from(await data.arrayBuffer());
    const { error: upErr } = await to.storage.from(BUCKET).upload(path, body, {
      contentType: data.type || "application/octet-stream",
      upsert: true,
    });
    if (upErr) {
      console.error(`  FAIL upload ${path}: ${upErr.message}`);
      failed += 1;
      continue;
    }
    copied += 1;
    if (copied % 25 === 0) console.log(`  …${copied}/${paths.length}`);
  }

  if (!COMMIT) {
    console.log(
      `\n${paths.length} objects would be copied. Re-run with --commit.`,
    );
    return;
  }

  console.log(`\nCopied ${copied}/${paths.length}. Failed: ${failed}.`);
  if (failed > 0) process.exitCode = 1;
  else {
    // Verify by counting the destination rather than trusting the upload calls.
    const after = await listAll(to);
    console.log(`Target bucket now holds ${after.length} objects.`);
    if (after.length !== paths.length) {
      console.error(
        "✖ Object counts differ — investigate before cutting over.",
      );
      process.exitCode = 1;
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
