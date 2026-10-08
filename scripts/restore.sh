#!/usr/bin/env bash
# Disaster recovery: put a backup made by scripts/backup.sh into a database whose schema was created by the migrations.
#   1. Create a new Supabase project (or empty database) and run every file in supabase/migrations in order.
#   2. DATABASE_URL=<direct connection string> ./scripts/restore.sh backups/isf-auth-*.dump backups/isf-public-*.dump
# It REPLACES the data in the target database, so it asks for confirmation. Triggers are switched off while loading so audit entries are not duplicated.
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to the direct Postgres connection string of the TARGET database}"
AUTHD="${1:?path to the isf-auth-*.dump file}"; PUBD="${2:?path to the isf-public-*.dump file}"
if [ "${CONFIRM:-}" != "yes" ]; then read -r -p "This ERASES all data in the target database and replaces it with the backup. Type RESTORE to continue: " ans; [ "$ans" = "RESTORE" ] || { echo "Cancelled."; exit 1; }; fi
export PGOPTIONS='-c session_replication_role=replica'
TABLES="$(psql "$DATABASE_URL" -Atc "select string_agg(format('%I.%I', schemaname, tablename), ', ') from pg_tables where schemaname = 'public' and tablename <> 'spatial_ref_sys'")"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "truncate $TABLES restart identity cascade" -c "delete from auth.users"
pg_restore --data-only --no-owner --no-privileges --dbname="$DATABASE_URL" "$AUTHD"
pg_restore --data-only --no-owner --no-privileges --dbname="$DATABASE_URL" "$PUBD"
echo "Restored. Rows now: schools=$(psql "$DATABASE_URL" -Atc 'select count(*) from public.schools'), users=$(psql "$DATABASE_URL" -Atc 'select count(*) from auth.users'), audit entries=$(psql "$DATABASE_URL" -Atc 'select count(*) from public.audit_log')"
