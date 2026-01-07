#!/bin/bash

# Discord Bot Restart Script
# This script stops any running bot instances and starts a new one

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Small delay to let the parent process finish its work if called from the bot
sleep 2

echo "🛑 Stopping any running bot instances..."

# Method 1: Use pkill to find and kill deno processes running index.ts
pkill -f "deno.*index.ts" 2>/dev/null

# Method 2: Find PIDs using ps and kill them
BOT_PIDS=$(ps aux | grep -E "deno.*index\.ts" | grep -v grep | awk '{print $2}')
if [ -n "$BOT_PIDS" ]; then
    echo "Found bot processes: $BOT_PIDS"
    echo "$BOT_PIDS" | xargs kill -15 2>/dev/null
    sleep 2
    # Force kill if still running
    echo "$BOT_PIDS" | xargs kill -9 2>/dev/null 2>/dev/null
fi

# Wait a moment for processes to terminate
sleep 2

# Check if port 8000 is in use (web server)
if command -v lsof > /dev/null 2>&1; then
    PORT_PID=$(lsof -ti:8000 2>/dev/null)
    if [ -n "$PORT_PID" ]; then
        echo "⚠️  Port 8000 is in use by PID $PORT_PID. Killing..."
        kill -15 "$PORT_PID" 2>/dev/null
        sleep 1
        kill -9 "$PORT_PID" 2>/dev/null 2>/dev/null
    fi
elif command -v netstat > /dev/null 2>&1; then
    # Alternative: use netstat (works on some systems)
    PORT_PID=$(netstat -tulpn 2>/dev/null | grep ":8000" | awk '{print $7}' | cut -d'/' -f1 | head -1)
    if [ -n "$PORT_PID" ] && [ "$PORT_PID" != "-" ]; then
        echo "⚠️  Port 8000 is in use by PID $PORT_PID. Killing..."
        kill -15 "$PORT_PID" 2>/dev/null
        sleep 1
        kill -9 "$PORT_PID" 2>/dev/null 2>/dev/null
    fi
fi

# Final check: wait a bit more and verify
sleep 1

# Verify processes are gone
REMAINING=$(ps aux | grep -E "deno.*index\.ts" | grep -v grep | wc -l | tr -d ' ')
if [ "$REMAINING" -gt 0 ]; then
    echo "⚠️  Warning: Some processes may still be running"
    ps aux | grep -E "deno.*index\.ts" | grep -v grep
else
    echo "✅ All bot processes stopped"
fi

echo ""
echo "🚀 Starting bot..."

# Load environment variables if .env exists
if [ -f .env ]; then
  echo "Loading environment variables from .env file..."
  export $(cat .env | grep -v '^#' | xargs)
fi

# Check for required environment variables
if [ -z "$DISCORD_TOKEN" ]; then
  echo "❌ Error: DISCORD_TOKEN is not set"
  echo "Please set it in .env file or export DISCORD_TOKEN=your_token"
  exit 1
fi

if [ -z "$APPLICATION_ID" ]; then
  echo "❌ Error: APPLICATION_ID is not set"
  echo "Please set it in .env file or export APPLICATION_ID=your_app_id"
  exit 1
fi

# Ensure Deno is in the PATH (common installation path)
export PATH="$HOME/.deno/bin:$PATH"

# Run the bot
echo "Starting bot with Deno..."
deno run --allow-all index.ts
