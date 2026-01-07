#!/bin/bash

# ML-Sharp Installation Script
# This script helps you clone and install ml-sharp

set -e

REPO_URL="https://github.com/apple/ml-sharp"
INSTALL_DIR="$HOME/repos/ml-sharp"

echo "🚀 ML-Sharp Installation Script"
echo "================================"
echo ""

# Step 1: Clone the repository
echo "📦 Cloning repository..."
if [ -d "$INSTALL_DIR" ]; then
    echo "⚠️  Directory $INSTALL_DIR already exists. Pulling latest changes..."
    cd "$INSTALL_DIR"
    git pull
else
    mkdir -p "$(dirname "$INSTALL_DIR")"
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

echo "✅ Repository cloned to $INSTALL_DIR"
echo ""

# Step 2: Examine the repository structure
echo "🔍 Analyzing repository structure..."
echo ""

# Check for common files
if [ -f "README.md" ]; then
    echo "📄 Found README.md - displaying first 50 lines:"
    echo "---"
    head -n 50 README.md
    echo "---"
    echo ""
fi

if [ -f "package.json" ]; then
    echo "📦 Found package.json (Node.js project)"
    echo "   Run: npm install"
    echo ""
fi

if [ -f "requirements.txt" ]; then
    echo "🐍 Found requirements.txt (Python project)"
    echo "   Run: pip install -r requirements.txt"
    echo ""
fi

if [ -f "setup.py" ]; then
    echo "🐍 Found setup.py (Python package)"
    echo "   Run: pip install -e ."
    echo ""
fi

if [ -f "CMakeLists.txt" ]; then
    echo "🔧 Found CMakeLists.txt (C/C++ project)"
    echo "   Run: mkdir build && cd build && cmake .. && make"
    echo ""
fi

if [ -f "Package.swift" ]; then
    echo "🦉 Found Package.swift (Swift package)"
    echo "   Run: swift build"
    echo ""
fi

# Check for installation scripts
if [ -f "install.sh" ]; then
    echo "📜 Found install.sh script"
    echo "   Run: ./install.sh"
    echo ""
fi

if [ -f "build.sh" ]; then
    echo "📜 Found build.sh script"
    echo "   Run: ./build.sh"
    echo ""
fi

echo "📂 Current directory: $(pwd)"
echo ""
echo "✨ Next steps:"
echo "   1. Review the README.md for specific installation instructions"
echo "   2. Check for any prerequisites listed in the documentation"
echo "   3. Run the appropriate installation command based on the project type"
echo ""
echo "💡 Tip: If you need help with installation, share the README.md contents with me!"
