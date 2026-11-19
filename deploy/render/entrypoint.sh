#!/bin/bash
# Starts the C++ API and the Next.js server in one container.
# Migrations (and demo accounts when DEMO_MODE=1) run inside the API on startup.
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to your PostgreSQL connection string}"
PORT="${PORT:-10000}"
export CORE_HOST=127.0.0.1
export CORE_PORT="${CORE_PORT:-8787}"
export CORE_URL="http://127.0.0.1:${CORE_PORT}"

# Writes are accepted only from the public origin. Render provides RENDER_EXTERNAL_URL automatically.
if [ -z "${WEB_ORIGINS:-}" ]; then
  if [ -n "${RENDER_EXTERNAL_URL:-}" ]; then
    WEB_ORIGINS="${RENDER_EXTERNAL_URL}"
  else
    echo "Set WEB_ORIGINS to the public https origin of this service (for example https://credwise-360.onrender.com)." >&2
    exit 1
  fi
fi
SEED_ORIGINS="${WEB_ORIGINS}"
if [ "${SEED_DEMO:-0}" = "1" ]; then
  SEED_ORIGINS="${WEB_ORIGINS},http://127.0.0.1:${PORT}"   # lets the in-container seed script pass the origin check
fi
export WEB_ORIGINS="${SEED_ORIGINS}"

probe() { node -e "fetch(process.argv[1]).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" "$1"; }

credwise &
CORE_PID=$!

# The API retries a sleeping database for about 30 seconds before exiting, so allow for that here.
for i in $(seq 1 120); do
  probe "${CORE_URL}/api/health" && break
  kill -0 "${CORE_PID}" 2>/dev/null || { echo "The API exited during startup." >&2; wait "${CORE_PID}" || true; exit 1; }
  sleep 1
done
probe "${CORE_URL}/api/health" || { echo "The API did not become ready." >&2; kill "${CORE_PID}" 2>/dev/null || true; exit 1; }

cd apps/web
node ../../node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port "${PORT}" &
WEB_PID=$!
cd ../..

if [ "${SEED_DEMO:-0}" = "1" ]; then
  (
    for i in $(seq 1 60); do probe "http://127.0.0.1:${PORT}/api/health" && break; sleep 1; done
    export WEB_URL="http://127.0.0.1:${PORT}"
    node scripts/seed-demo.mjs && node scripts/seed-demo-extras.mjs || echo "Demo seeding did not finish; the app is still running." >&2
  ) &
fi

trap 'kill "${CORE_PID}" "${WEB_PID}" 2>/dev/null || true' TERM INT
# If either process stops, stop the other so Render restarts the whole service.
set +e
wait -n "${CORE_PID}" "${WEB_PID}"
STATUS=$?
kill "${CORE_PID}" "${WEB_PID}" 2>/dev/null
exit "${STATUS}"
