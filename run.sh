#!/bin/bash
# iBUS@MUJ WiFi BSSID Mapper - Local Hardware Launcher with Automatic MongoDB Setup

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# 1. Automatic MongoDB & Environment Setup
if [ -f "./setup_mongo.sh" ]; then
    ./setup_mongo.sh
fi

# Load PORT from .env if present
if [ -f ".env" ]; then
    set -a
    source .env 2>/dev/null || true
    set +a
fi

PORT="${PORT:-5000}"

echo "======================================================"
echo "📡 iBUS@MUJ WiFi BSSID Mapper · Local Hardware Server"
echo "======================================================"
echo "Directly interfaces with your WiFi chip using Linux nmcli."
echo "Opening browser at: http://localhost:$PORT"
echo "======================================================"

# Open browser after 1.5s
(sleep 1.5 && (xdg-open "http://localhost:$PORT" 2>/dev/null || sensible-browser "http://localhost:$PORT" 2>/dev/null || echo "Please open http://localhost:$PORT in your browser")) &

python3 server.py
