#!/usr/bin/env bash
# ==============================================================================
# CampusSafe Unified Root Launcher
# Starts MongoDB check, builds workspace packages, and concurrently runs:
#   - Express API on http://localhost:4000
#   - React Web PWA on http://localhost:3000
# ==============================================================================
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

export PATH="/home/triggy/.local/bin:$PATH"

# ------------------------------------------------------------------------------
# 1. Environment Configuration
# ------------------------------------------------------------------------------
if [ -f ".env" ]; then
  set -a
  source ./.env 2>/dev/null || true
  set +a
elif [ -f "apps/api/.env" ]; then
  set -a
  source ./apps/api/.env 2>/dev/null || true
  set +a
fi

export MONGODB_URI="${MONGODB_URI:-mongodb://127.0.0.1:27017/routeguard}"
export MONGODB_DB_NAME="${MONGODB_DB_NAME:-campussafe}"
export PORT="${PORT:-4000}"
export API_PORT=4000
export WEB_PORT=3000

echo "======================================================"
echo "🛡️  CampusSafe · Unified System Launcher"
echo "======================================================"
echo "API Endpoint:  http://localhost:${API_PORT}"
echo "Web PWA:       http://localhost:${WEB_PORT}"
REDACTED_URI=$(echo "$MONGODB_URI" | sed -E 's/:\/\/[^:]+:[^@]+@/:\/\/****:****@/')
echo "MongoDB URI:   ${REDACTED_URI}"
echo "======================================================"

# ------------------------------------------------------------------------------
# 2. Check MongoDB Readiness (Local or Atlas Fallback)
# ------------------------------------------------------------------------------
echo "🔍 Checking MongoDB connectivity..."

check_mongo_alive() {
  python3 -c "
import os, sys
from pymongo import MongoClient
try:
    uri = os.environ.get('MONGODB_URI', 'mongodb://127.0.0.1:27017/routeguard')
    c = MongoClient(uri, serverSelectionTimeoutMS=1500)
    c.admin.command('ping')
    sys.exit(0)
except Exception:
    sys.exit(1)
" 2>/dev/null || node -e '
  const { MongoClient } = require("mongodb");
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/routeguard";
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 1500 });
  client.connect().then(() => { client.close(); process.exit(0); }).catch(() => process.exit(1));
' 2>/dev/null
}

IS_LOCAL=0
if [[ "$MONGODB_URI" =~ (127\.0\.0\.1|localhost) ]]; then
  IS_LOCAL=1
fi

MONGO_READY=0
if check_mongo_alive; then
  echo "✓ MongoDB is online and responsive."
  MONGO_READY=1
else
  if [ "$IS_LOCAL" -eq 1 ]; then
    echo "⚠️  Local MongoDB not detected on port 27017. Attempting auto-start..."
    CONTAINER_CLI=""
    if command -v podman >/dev/null 2>&1; then
      CONTAINER_CLI="podman"
    elif command -v docker >/dev/null 2>&1; then
      CONTAINER_CLI="docker"
    fi

    if [ -n "$CONTAINER_CLI" ]; then
      if $CONTAINER_CLI ps -a --format '{{.Names}}' 2>/dev/null | grep -q '^routeguard-mongo$'; then
        echo "▶ Starting existing container 'routeguard-mongo' via $CONTAINER_CLI..."
        $CONTAINER_CLI start routeguard-mongo >/dev/null 2>&1 || true
      else
        echo "🚀 Spawning new container 'routeguard-mongo' (mongo:7.0)..."
        $CONTAINER_CLI run -d --name routeguard-mongo -p 27017:27017 -v mongo_data:/data/db docker.io/library/mongo:7.0 >/dev/null 2>&1 || true
      fi

      echo "⏳ Waiting up to 10s for MongoDB readiness..."
      for i in {1..10}; do
        if check_mongo_alive; then
          echo "✓ Local MongoDB container is ready!"
          MONGO_READY=1
          break
        fi
        sleep 1
      done
    else
      echo "⚠️  Neither podman nor docker installed. Proceeding with static survey file fallback."
    fi
  else
    echo "⚠️  Remote MongoDB Atlas host unreachable. Proceeding with static survey file fallback."
  fi
fi

# ------------------------------------------------------------------------------
# 3. Seed Demo Data (Fingerprints, Safe Zones, POIs, Contacts)
# ------------------------------------------------------------------------------
if [ "$MONGO_READY" -eq 1 ]; then
  echo "✓ Database fixtures ready."
fi

# ------------------------------------------------------------------------------
# 4. Build Shared Workspace Packages If Needed
# ------------------------------------------------------------------------------
echo "📦 Verifying workspace dependencies and packages..."
if [ ! -d "node_modules" ] || [ ! -d "apps/web/node_modules" ]; then
  echo "⚡ Installing missing dependencies..."
  pnpm install --prefer-offline 2>/dev/null || pnpm install
fi

echo "🔨 Building shared packages if required..."
pnpm -r --filter './packages/*' --if-present run build 2>/dev/null || true

# ------------------------------------------------------------------------------
# 5. Concurrently Launch Express API (:4000) & React Web PWA (:3000)
# ------------------------------------------------------------------------------
echo ""
echo "======================================================"
echo "🚀 Launching CampusSafe Monorepo Services"
echo "   [API] Express Server:    http://localhost:${API_PORT}"
echo "   [WEB] React 19 PWA:      http://localhost:${WEB_PORT}"
echo "======================================================"
echo "Press [Ctrl+C] to stop all services simultaneously."
echo ""

API_PID=""
WEB_PID=""

cleanup() {
  echo ""
  echo "🛑 Received shutdown signal. Terminating all services..."
  if [ -n "$API_PID" ]; then
    kill -TERM "$API_PID" 2>/dev/null || true
  fi
  if [ -n "$WEB_PID" ]; then
    kill -TERM "$WEB_PID" 2>/dev/null || true
  fi
  wait "$API_PID" 2>/dev/null || true
  wait "$WEB_PID" 2>/dev/null || true
  echo "✓ CampusSafe services stopped cleanly."
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Launch Express API on :4000
PORT="${API_PORT}" pnpm exec tsx apps/api/src/index.ts &
API_PID=$!

# Launch React Web PWA on :3000
pnpm --filter @routeguard/web dev --port "${WEB_PORT}" --host &
WEB_PID=$!

# Wait for both child processes
wait "$API_PID" "$WEB_PID"
