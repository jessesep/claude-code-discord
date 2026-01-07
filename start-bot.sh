#!/bin/bash
# one agent discord - Bot Startup Script (Foreground)
# This script sets up the environment and starts the bot in the current terminal

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if .env file exists
if [ -f .env ]; then
  echo "Loading environment variables from .env file..."
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

if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "⚠️  Warning: ANTHROPIC_API_KEY is not set"
  echo "The bot will show setup instructions when needed."
  echo ""
fi

# Ensure Deno is in the PATH
export PATH="$HOME/.deno/bin:$PATH"

echo "✅ Environment variables loaded"
echo "Starting Discord bot in foreground..."
echo "Note: Close this terminal or press Ctrl+C to stop the bot."
echo ""

# Run the bot
deno run --allow-all index.ts
