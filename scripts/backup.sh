#!/usr/bin/env bash
# Logical backup of the application data: your schools, translations, users, claims and audit log.
# Complements (does not replace) Supabase's own daily backups / point-in-time recovery.
#   DATABASE_URL=postgresql://postgres:***@db.<ref>.supabase.co:5432/postgres ./scripts/backup.sh [output-dir]
# Storage files (school photos) are not in the database: copy them with `supabase storage cp` or any S3-compatible tool (see DEPLOYMENT.md).
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to the direct Postgres connection string}"
OUT="${1:-backups}"; KEEP_DAYS="${KEEP_DAYS:-30}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"; PUB="$OUT/isf-public-$STAMP.dump"; AUTH="$OUT/isf-auth-$STAMP.dump"
mkdir -p "$OUT"
# Two archives: the application data, and the user accounts (with password hashes) so people can sign in again after a restore.
# They are separate because pg_dump combines --schema and --table with AND, which would silently drop the application tables.
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --schema=public --file="$PUB"
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --table='auth.users' --table='auth.identities' --file="$AUTH"
# A backup you have not checked is not a backup: make sure each archive can be read and really contains the data.
pg_restore --list "$PUB" > "$PUB.toc"; pg_restore --list "$AUTH" > "$AUTH.toc"
for t in schools school_translations audit_log user_roles school_claims; do grep -q "TABLE DATA public $t " "$PUB.toc" || { echo "FAILED: $t missing from $PUB" >&2; exit 1; }; done
grep -q "TABLE DATA auth users " "$AUTH.toc" || { echo "FAILED: auth.users missing from $AUTH" >&2; exit 1; }
for f in "$PUB" "$AUTH"; do (sha256sum "$f" 2>/dev/null || shasum -a 256 "$f") > "$f.sha256"; done
find "$OUT" -name 'isf-*' -mtime +"$KEEP_DAYS" -delete
echo "OK: $PUB ($(du -h "$PUB" | cut -f1)) and $AUTH ($(du -h "$AUTH" | cut -f1)); $(grep -c 'TABLE DATA' "$PUB.toc") application tables verified"
