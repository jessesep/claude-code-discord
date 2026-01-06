#!/bin/bash

# Discord Bot Startup Script
# This script sets up the environment and starts the bot

# Check if .env file exists
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

if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "⚠️  Warning: ANTHROPIC_API_KEY is not set"
  echo "The bot will show setup instructions when needed."
  echo ""
fi

echo "✅ Environment variables loaded"
echo "Starting Discord bot..."
echo ""

# Run the bot
/Users/jessesep/.deno/bin/deno run \
  --allow-net \
  --allow-read \
  --allow-write \
  --allow-env \
  --allow-run \
  discord/main.ts
