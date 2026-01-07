#!/bin/bash
# one agent discord - Reboot Script
# Restarts the bot, server, and testing bot processes

# Get project directory
PROJECT_DIR="/Users/jessesep/repos/claude-code-discord"
cd "$PROJECT_DIR"

# Ensure Deno is in PATH
export PATH="$HOME/.deno/bin:$PATH"

# Load .env if it exists
if [ -f .env ]; then
  # Using a safer way to export .env variables
  export $(grep -v '^#' .env | xargs)
fi

# Define notify helper
notify_discord() {
  deno run --allow-all scripts/notify-discord.ts "$1" "$2" "$3" >/dev/null 2>&1
}

# 1. Kill existing processes
echo "Stopping existing processes..."
notify_discord "🔄 Reboot Initiated" "Stopping existing bot and server processes..." "0xffff00"

pkill -f "deno.*index.ts" || true
pkill -f "deno.*tests/e2e-tester-bot.ts" || true
# Kill anything on port 8000 (web server)
lsof -ti:8000 | xargs kill -9 2>/dev/null || true

# Wait for cleanup
sleep 2

# 2. Start Main Bot and Server
echo "Starting Main Bot and Server..."
notify_discord "🚀 Main Bot" "Starting main bot process..." "0x5865F2"

# Run in background with nohup
nohup deno run --allow-all index.ts >> bot_output.log 2>&1 &

# 3. Reboot Testing Bot (Run E2E Suite)
echo "Rebooting Testing Bot..."
if [ ! -z "$TEST_BOT_TOKEN" ]; then
    notify_discord "🧪 Testing Bot" "Starting E2E test bot sequence..." "0x9b59b6"
    nohup deno run --allow-all tests/e2e-tester-bot.ts >> tests_output.log 2>&1 &
    echo "Testing bot started in background."
else
    echo "Note: TEST_BOT_TOKEN not set, skipping background test bot."
    notify_discord "🧪 Testing Bot" "⚠️ TEST_BOT_TOKEN not set, skipping test bot sequence." "0xff0000"
fi

echo "✅ Reboot initiated. Check bot_output.log for status."
