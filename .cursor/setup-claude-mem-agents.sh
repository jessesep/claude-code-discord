#!/bin/bash
# Setup Claude-Mem for Multi-Agent Support
# This script configures claude-mem to work with Cursor and Antigravity agents

set -e

CLAUDE_MEM_DIR="$HOME/.claude/plugins/cache/thedotmack/claude-mem"
PROJECT_DIR="/Users/jessesep/repos/claude-code-discord"

echo "🔧 Setting up Claude-Mem for multi-agent support..."
echo ""

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "⚠️  Bun is not installed. Installing..."
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
fi

# Find the latest claude-mem version
CLAUDE_MEM_VERSION_DIR=$(find "$HOME/.claude/plugins/cache/thedotmack/claude-mem" -maxdepth 1 -type d -name "[0-9]*" | sort -V | tail -1)

if [ -z "$CLAUDE_MEM_VERSION_DIR" ]; then
    echo "❌ Claude-mem plugin not found. Please install it first:"
    echo "   claude plugin install claude-mem@thedotmack"
    exit 1
fi

echo "📦 Found claude-mem at: $CLAUDE_MEM_VERSION_DIR"
cd "$CLAUDE_MEM_VERSION_DIR"

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "⚠️  package.json not found. Checking for alternative structure..."
    # Try to find the actual plugin directory
    if [ -d ".claude-plugin" ]; then
        echo "✅ Found .claude-plugin directory"
    else
        echo "❌ Could not find claude-mem plugin files"
        exit 1
    fi
fi

# 1. Install Cursor hooks (if script exists)
if [ -f "package.json" ] && grep -q "cursor:install" package.json 2>/dev/null; then
    echo ""
    echo "📌 Installing Cursor hooks..."
    bun run cursor:install || echo "⚠️  Cursor hooks installation failed (may need manual setup)"
else
    echo ""
    echo "⚠️  Cursor hooks script not found. Manual installation may be required."
    echo "   See: https://docs.claude-mem.ai/cursor"
fi

# 2. Check worker status
echo ""
echo "🚀 Checking worker service..."
if bun run worker:status 2>/dev/null | grep -q "running"; then
    echo "✅ Worker is already running"
else
    echo "⚠️  Worker is not running. Start it with:"
    echo "   cd $CLAUDE_MEM_VERSION_DIR"
    echo "   bun run worker:start"
fi

# 3. Verify installation
echo ""
echo "✅ Verifying installation..."
if [ -f "package.json" ]; then
    bun run cursor:status 2>/dev/null || echo "⚠️  Could not check cursor status"
    bun run worker:status 2>/dev/null || echo "⚠️  Could not check worker status"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📊 Next steps:"
echo "1. View memories at: http://localhost:37777"
echo "2. Restart Cursor IDE to activate hooks"
echo "3. Test with: /agent action:start agent_name:cursor-debugger"
echo "4. Check memory viewer for captured data"
echo ""
echo "📖 For Antigravity agents, context injection is handled automatically"
echo "   via the util/claude-mem-context.ts utility."
