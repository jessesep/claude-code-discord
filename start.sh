#!/bin/bash

# Simple Discord Bot Start Script (Background)
# This script starts the bot in the background if it's not already running

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LOG_FILE="bot.log"

# Check if bot is already running
PID=$(ps aux | grep -E "deno.*index\.ts" | grep -v grep | awk '{print $2}')
if [ -n "$PID" ]; then
  echo "⚠️  Bot is already running with PID: $PID"
  echo "Use ./reboot.sh if you want to restart it."
  exit 0
fi

echo "🚀 Starting bot in background..."

# Load environment variables
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# Ensure Deno is in the PATH
export PATH="$HOME/.deno/bin:$PATH"

# Start the bot
nohup deno run --allow-all index.ts >> "$LOG_FILE" 2>&1 &

NEW_PID=$!
echo "✅ Bot started in background with PID: $NEW_PID"
echo "📂 Logs: $LOG_FILE"
echo "Use 'tail -f $LOG_FILE' to watch output."
