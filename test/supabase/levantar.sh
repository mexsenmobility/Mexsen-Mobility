#!/usr/bin/env bash
# Levanta la imitación local de Supabase para pruebas: Postgres :5499, PostgREST :3001, gateway :54321.
set -e
PG=/usr/lib/postgresql/16/bin
DIR=$(cd "$(dirname "$0")" && pwd)
if ! pg_isready -h /tmp/pg -p 5499 -q 2>/dev/null; then
  su postgres -c "$PG/pg_ctl -D /tmp/pg/data -o '-p 5499 -k /tmp/pg' -l /tmp/pg/log start" >/dev/null
  sleep 2
fi
pgrep -f "postgrest /tmp/pgrst.conf" >/dev/null || (nohup /tmp/postgrest /tmp/pgrst.conf > /tmp/pgrst.log 2>&1 &)
pgrep -f "node .*fake_supabase.js" >/dev/null || (nohup node "$DIR/fake_supabase.js" > /tmp/fsb.log 2>&1 &)
sleep 2
echo "Postgres: $(pg_isready -h /tmp/pg -p 5499)"; tail -1 /tmp/pgrst.log; head -1 /tmp/fsb.log
