#!/usr/bin/env bash
# Builds a scratch PostgreSQL database from the migrations and runs the assertion-based security audit.
# Needs a Postgres 15+ server with the PostGIS and pg_trgm extensions available (the postgis/postgis Docker image has both).
#   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres ./scripts/db-test.sh
# The other files in supabase/tests print results for a person to read; this script runs the one that fails the build when permissions drift.
set -euo pipefail
cd "$(dirname "$0")/.."
DB="isf_test_$$"
psql -q -v ON_ERROR_STOP=1 -d postgres -c "create database $DB"
trap 'psql -q -d postgres -c "drop database if exists $DB" >/dev/null' EXIT
run() { psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run supabase/tests/00_supabase_stub.sql          # stands in for Supabase's auth/storage schemas and roles
for f in supabase/migrations/*.sql; do echo "migration $(basename "$f")"; run "$f"; done
run supabase/seed.sql
echo "--- security audit"; run supabase/tests/09_security_audit.sql
echo "ALL DATABASE CHECKS PASSED"
