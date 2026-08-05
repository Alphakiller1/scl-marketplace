#!/usr/bin/env bash
#
# Move the `scl` schema to a Supabase project owned by the SCL owners.
#
# The current project is the shared "betting-brain" instance (see CLAUDE.md) —
# `public` there is a separate analytics database. Transferring the project would
# hand that over too, so we migrate ONLY the `scl` schema into a fresh project.
#
# Run from the repo root in Git Bash:
#
#   export OLD_DIRECT_URL='postgresql://...@...:5432/postgres'   # session/direct, NOT :6543
#   export NEW_DIRECT_URL='postgresql://...@...:5432/postgres'
#   ./scripts/migrate-supabase-project.sh check     # counts both sides, writes nothing
#   ./scripts/migrate-supabase-project.sh dump
#   ./scripts/migrate-supabase-project.sh restore
#   ./scripts/migrate-supabase-project.sh verify    # diffs row counts old vs new
#
# pg_dump must be >= the server version. Supabase runs a recent Postgres and the
# Windows/Git-Bash client is usually older, which fails with a confusing version
# error — so everything routes through Docker by default. Set USE_DOCKER=0 to use
# a local client instead.

set -euo pipefail

SCHEMA="${SCHEMA:-scl}"
DUMP_FILE="${DUMP_FILE:-scl-schema.dump}"
USE_DOCKER="${USE_DOCKER:-1}"
PG_IMAGE="${PG_IMAGE:-postgres:17}"

# Exact per-table counts. `n_live_tup` from pg_stat_user_tables is only an
# estimate and drifts badly after a bulk load, which is precisely the situation
# we are verifying — so count for real via query_to_xml.
COUNT_SQL="
SELECT table_name,
       (xpath('/row/c/text()',
              query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name),
                           false, true, '')))[1]::text::bigint AS rows
FROM information_schema.tables
WHERE table_schema = '${SCHEMA}' AND table_type = 'BASE TABLE'
ORDER BY table_name;
"

require() {
  if [ -z "${!1:-}" ]; then echo "✖ \$$1 is not set." >&2; exit 1; fi
}

guard_direct() {
  # pg_dump cannot run through pgbouncer's transaction pooling.
  case "$1" in
    *:6543*|*pgbouncer=true*)
      echo "✖ $2 points at the transaction pooler (:6543 / pgbouncer=true)." >&2
      echo "  pg_dump needs the session/direct connection on :5432." >&2
      exit 1;;
  esac
}

psql_run() {  # psql_run <url> <sql>
  if [ "$USE_DOCKER" = "1" ]; then
    docker run --rm -i "$PG_IMAGE" psql "$1" -v ON_ERROR_STOP=1 -At -F$'\t' -c "$2"
  else
    psql "$1" -v ON_ERROR_STOP=1 -At -F$'\t' -c "$2"
  fi
}

case "${1:-}" in

  check)
    require OLD_DIRECT_URL
    guard_direct "$OLD_DIRECT_URL" OLD_DIRECT_URL
    echo "== SOURCE ($SCHEMA) =="
    psql_run "$OLD_DIRECT_URL" "$COUNT_SQL" | tee /tmp/scl-counts-old.tsv
    echo
    if [ -n "${NEW_DIRECT_URL:-}" ]; then
      guard_direct "$NEW_DIRECT_URL" NEW_DIRECT_URL
      echo "== TARGET ($SCHEMA) =="
      psql_run "$NEW_DIRECT_URL" "$COUNT_SQL" || echo "(schema does not exist yet — expected before restore)"
    fi
    ;;

  dump)
    require OLD_DIRECT_URL
    guard_direct "$OLD_DIRECT_URL" OLD_DIRECT_URL
    echo "== Dumping schema '$SCHEMA' =="
    # --no-owner / --no-privileges: role names differ between projects, and
    # keeping them makes the restore fail on every GRANT.
    if [ "$USE_DOCKER" = "1" ]; then
      docker run --rm -i "$PG_IMAGE" pg_dump "$OLD_DIRECT_URL" \
        --schema="$SCHEMA" --no-owner --no-privileges -Fc > "$DUMP_FILE"
    else
      pg_dump "$OLD_DIRECT_URL" --schema="$SCHEMA" --no-owner --no-privileges -Fc -f "$DUMP_FILE"
    fi
    echo "Wrote $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))"
    echo "⚠ This file contains every user record. Delete it once the restore is verified."
    ;;

  restore)
    require NEW_DIRECT_URL
    guard_direct "$NEW_DIRECT_URL" NEW_DIRECT_URL
    [ -f "$DUMP_FILE" ] || { echo "✖ $DUMP_FILE not found — run 'dump' first." >&2; exit 1; }

    # Refuse to restore over an existing populated schema. Re-running a restore
    # on top of data produces duplicate-key errors half-way through and leaves
    # the target in an unknown state.
    existing=$(psql_run "$NEW_DIRECT_URL" \
      "SELECT count(*) FROM information_schema.tables WHERE table_schema='${SCHEMA}';" 2>/dev/null || echo 0)
    if [ "${existing:-0}" != "0" ]; then
      echo "✖ Target already has $existing tables in '$SCHEMA'." >&2
      echo "  Drop it first if you really mean to replace it:" >&2
      echo "    DROP SCHEMA ${SCHEMA} CASCADE;" >&2
      exit 1
    fi

    echo "== Restoring into target =="
    if [ "$USE_DOCKER" = "1" ]; then
      docker run --rm -i "$PG_IMAGE" pg_restore -d "$NEW_DIRECT_URL" \
        --no-owner --no-privileges < "$DUMP_FILE"
    else
      pg_restore -d "$NEW_DIRECT_URL" --no-owner --no-privileges "$DUMP_FILE"
    fi
    echo "Restore complete. Run '$0 verify' next."
    ;;

  verify)
    require OLD_DIRECT_URL
    require NEW_DIRECT_URL
    psql_run "$OLD_DIRECT_URL" "$COUNT_SQL" > /tmp/scl-counts-old.tsv
    psql_run "$NEW_DIRECT_URL" "$COUNT_SQL" > /tmp/scl-counts-new.tsv
    echo "== Row count diff (old vs new) =="
    if diff -u /tmp/scl-counts-old.tsv /tmp/scl-counts-new.tsv; then
      echo
      echo "✅ Every table matches exactly."
      echo "   Tables: $(wc -l < /tmp/scl-counts-old.tsv)"
      echo "   Total rows: $(awk -F'\t' '{s+=$2} END {print s}' /tmp/scl-counts-old.tsv)"
      echo
      echo "Still to do:"
      echo "  1. npx tsx scripts/copy-supabase-storage.ts   # avatars/covers are NOT in the schema dump"
      echo "  2. Point DATABASE_URL (:6543, pgbouncer=true, schema=scl) and DIRECT_URL (:5432) at the new project"
      echo "  3. Delete $DUMP_FILE"
    else
      echo
      echo "✖ Counts differ — do NOT repoint the app yet." >&2
      exit 1
    fi
    ;;

  *)
    echo "usage: $0 {check|dump|restore|verify}" >&2
    exit 1;;
esac
