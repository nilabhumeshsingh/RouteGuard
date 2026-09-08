#!/usr/bin/env bash
# ==============================================================================
# setup_mongo.sh - Automatic MongoDB & Environment Initializer
# ==============================================================================
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# 1. Ensure .env exists
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "📄 Creating .env from .env.example..."
        cp .env.example .env
    else
        echo "MONGODB_URI=mongodb://127.0.0.1:27017/routeguard" > .env
        echo "MONGODB_DB_NAME=routeguard" >> .env
        echo "PORT=5000" >> .env
    fi
fi

# Load environment variables
set -a
source .env 2>/dev/null || true
set +a

MONGODB_URI="${MONGODB_URI:-mongodb://127.0.0.1:27017/routeguard}"
MONGODB_DB_NAME="${MONGODB_DB_NAME:-routeguard}"

echo "======================================================"
echo "🍃 RouteGuard · MongoDB Setup & Auto-Detection"
echo "======================================================"
echo "Configured URI: $MONGODB_URI"
echo "Database Name:  $MONGODB_DB_NAME"

# 2. Ensure Python dependencies
echo "📦 Checking Python dependencies..."
python3 -c "import pymongo, dotenv, dns" 2>/dev/null || {
    echo "⚡ Installing missing dependencies (pymongo, python-dotenv, dnspython)..."
    python3 -m pip install -q pymongo python-dotenv dnspython
}
echo "✓ Python dependencies verified."

# 3. Check if local MongoDB container needed
IS_LOCAL=0
if [[ "$MONGODB_URI" =~ (127\.0\.0\.1|localhost) ]]; then
    IS_LOCAL=1
fi

check_mongo_alive() {
    python3 -c "
import sys
from pymongo import MongoClient
try:
    c = MongoClient('$MONGODB_URI', serverSelectionTimeoutMS=1500)
    c.admin.command('ping')
    sys.exit(0)
except Exception:
    sys.exit(1)
" 2>/dev/null
}

if check_mongo_alive; then
    echo "✓ MongoDB is connected and operational!"
else
    if [ "$IS_LOCAL" -eq 1 ]; then
        echo "🔍 Local MongoDB instance not detected on port 27017."
        
        # Check if podman or docker is available to auto-spawn local MongoDB
        CONTAINER_CLI=""
        if command -v podman >/dev/null 2>&1; then
            CONTAINER_CLI="podman"
        elif command -v docker >/dev/null 2>&1; then
            CONTAINER_CLI="docker"
        fi

        if [ -n "$CONTAINER_CLI" ]; then
            echo "🐳 Using $CONTAINER_CLI to start local MongoDB container 'routeguard-mongo'..."
            
            if $CONTAINER_CLI ps -a --format '{{.Names}}' 2>/dev/null | grep -q '^routeguard-mongo$'; then
                echo "▶ Starting existing container 'routeguard-mongo'..."
                $CONTAINER_CLI start routeguard-mongo >/dev/null
            else
                echo "🚀 Creating and running new MongoDB container (docker.io/library/mongo:7.0)..."
                $CONTAINER_CLI run -d --name routeguard-mongo -p 27017:27017 -v mongo_data:/data/db docker.io/library/mongo:7.0 >/dev/null
            fi

            echo "⏳ Waiting for MongoDB to become ready..."
            for i in {1..15}; do
                if check_mongo_alive; then
                    echo "✓ MongoDB is up and running in container!"
                    break
                fi
                sleep 1
            done
        else
            echo "⚠️  Neither podman nor docker found. Server will run with automatic SQLite fallback."
        fi
    else
        echo "⚠️  Remote MongoDB Atlas/host not reachable at '$MONGODB_URI'."
        echo "    Check your network connection and .env credentials."
        echo "    Server will start with automatic SQLite fallback if unreachable."
    fi
fi

echo "======================================================"
