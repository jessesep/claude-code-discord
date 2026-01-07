#!/bin/bash

# Discord Bot Reboot Script
# This script stops any running bot instances and starts a new one in the background

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Log file for the bot
LOG_FILE="bot.log"
RESTART_LOG="bot_restart.log"

echo "🛑 Stopping any running bot instances..." | tee -a "$RESTART_LOG"

# Method 1: Use the Process Manager (Deno) for reliable cleanup
if [ -f "restart-bot.ts" ]; then
    # We'll use a modified version of the restart command that just stops
    # But for now, we'll use the shell methods which are usually sufficient
    echo "Using shell methods to stop processes..."
fi

# Kill any deno processes running index.ts
pkill -f "deno.*index.ts" 2>/dev/null

# Find PIDs using ps and kill them (fallback)
BOT_PIDS=$(ps aux | grep -E "deno.*index\.ts" | grep -v grep | awk '{print $2}')
if [ -n "$BOT_PIDS" ]; then
    echo "Found bot processes: $BOT_PIDS. Killing..." | tee -a "$RESTART_LOG"
    echo "$BOT_PIDS" | xargs kill -15 2>/dev/null
    sleep 2
    echo "$BOT_PIDS" | xargs kill -9 2>/dev/null 2>/dev/null
fi

# Check if port 8000 is in use (web server)
if command -v lsof > /dev/null 2>&1; then
    PORT_PID=$(lsof -ti:8000 2>/dev/null)
    if [ -n "$PORT_PID" ]; then
        echo "⚠️  Port 8000 is in use by PID $PORT_PID. Killing..." | tee -a "$RESTART_LOG"
        kill -15 "$PORT_PID" 2>/dev/null
        sleep 1
        kill -9 "$PORT_PID" 2>/dev/null 2>/dev/null
    fi
fi

# Final check: wait a bit more and verify
sleep 2

# Verify processes are gone
REMAINING=$(ps aux | grep -E "deno.*index\.ts" | grep -v grep | wc -l | tr -d ' ')
if [ "$REMAINING" -gt 0 ]; then
    echo "⚠️  Warning: Some processes may still be running" | tee -a "$RESTART_LOG"
else
    echo "✅ All bot processes stopped" | tee -a "$RESTART_LOG"
fi

echo "" | tee -a "$RESTART_LOG"
echo "🚀 Starting bot in background..." | tee -a "$RESTART_LOG"

# Load environment variables if .env exists
if [ -f .env ]; then
  echo "Loading environment variables from .env file..." | tee -a "$RESTART_LOG"
  # Use a more robust way to export .env
  set -a
  source .env
  set +a
fi

# Check for required environment variables
if [ -z "$DISCORD_TOKEN" ]; then
  echo "❌ Error: DISCORD_TOKEN is not set" | tee -a "$RESTART_LOG"
  exit 1
fi

if [ -z "$APPLICATION_ID" ]; then
  echo "❌ Error: APPLICATION_ID is not set" | tee -a "$RESTART_LOG"
  exit 1
fi

# Ensure Deno is in the PATH
export PATH="$HOME/.deno/bin:$PATH"

# Start the bot using nohup to keep it running in the background
# This starts both the Discord bot and the Web Server (port 8000)
nohup deno run --allow-all index.ts >> "$LOG_FILE" 2>&1 &

# Capture the new PID
NEW_PID=$!

echo "✅ Bot started in background with PID: $NEW_PID" | tee -a "$RESTART_LOG"
echo "📂 Bot logs are being written to: $LOG_FILE" | tee -a "$RESTART_LOG"
echo "📂 Restart logs are in: $RESTART_LOG" | tee -a "$RESTART_LOG"
echo "" | tee -a "$RESTART_LOG"
echo "Use 'tail -f $LOG_FILE' to see the bot output."
