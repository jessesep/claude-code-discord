#!/bin/bash
# Claude Code Plugin Setup Script
# Run this in Claude Code terminal

echo "🔌 Setting up Claude Code plugins for claude-code-discord project"
echo ""

echo "1️⃣ Adding Anthropics demo marketplace..."
/plugin marketplace add anthropics/claude-code

echo ""
echo "2️⃣ Available plugins to install:"
echo "   - code-review: Automated code reviews"
echo "   - commit-commands: Git workflow automation"
echo "   - pr-review-toolkit: PR review automation"
echo ""

echo "3️⃣ To install plugins, run:"
echo "   /plugin install code-review@anthropics-claude-code --scope project"
echo "   /plugin install commit-commands@anthropics-claude-code"
echo "   /plugin install pr-review-toolkit@anthropics-claude-code --scope project"
echo ""

echo "4️⃣ To browse all available plugins:"
echo "   /plugin"
echo "   (Navigate to 'Discover' tab)"
echo ""

echo "✅ Setup complete! See PLUGIN_INTEGRATION_GUIDE.md for details."
