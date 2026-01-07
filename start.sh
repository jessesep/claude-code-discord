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

# Load environment variables
if [ -f .env ]; then
  set -a
  source .env
  set +a
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

# Ensure Deno is in the PATH
export PATH="$HOME/.deno/bin:$PATH"

echo "🚀 Starting bot in background..."

# Start the bot
nohup deno run --allow-all index.ts >> "$LOG_FILE" 2>&1 &

NEW_PID=$!
echo "✅ Bot started in background with PID: $NEW_PID"
echo "📂 Logs: $LOG_FILE"
echo "Use 'tail -f $LOG_FILE' to watch output."
