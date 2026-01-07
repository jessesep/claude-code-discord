#!/bin/bash
# Script to investigate Apple's SHAR Gaussian Splat tool installation

set -e

REPO_URL="https://github.com/apple/ml-shar.git"
INVESTIGATION_DIR="$HOME/repos/shar-investigation"

echo "🔍 Investigating SHAR (Scene History and Rendering) Installation"
echo "================================================================"
echo ""

# Create investigation directory
mkdir -p "$INVESTIGATION_DIR"
cd "$INVESTIGATION_DIR"

# Clone the repository
echo "📦 Cloning repository..."
if [ -d "ml-shar" ]; then
    echo "   Repository already exists, pulling latest changes..."
    cd ml-shar
    git pull
else
    git clone "$REPO_URL"
    cd ml-shar
fi

echo ""
echo "📄 Repository Structure:"
echo "-----------------------"
ls -la

echo ""
echo "📖 README.md Contents:"
echo "---------------------"
if [ -f "README.md" ]; then
    head -100 README.md
else
    echo "   No README.md found"
fi

echo ""
echo "📋 Installation Files Found:"
echo "---------------------------"
[ -f "requirements.txt" ] && echo "   ✅ requirements.txt" && head -20 requirements.txt && echo ""
[ -f "pyproject.toml" ] && echo "   ✅ pyproject.toml" && head -30 pyproject.toml && echo ""
[ -f "setup.py" ] && echo "   ✅ setup.py" && head -30 setup.py && echo ""
[ -f "environment.yml" ] && echo "   ✅ environment.yml" && head -30 environment.yml && echo ""
[ -f "CMakeLists.txt" ] && echo "   ✅ CMakeLists.txt" && head -20 CMakeLists.txt && echo ""
[ -f "build.sh" ] && echo "   ✅ build.sh" && head -20 build.sh && echo ""
[ -f "install.sh" ] && echo "   ✅ install.sh" && head -20 install.sh && echo ""

echo ""
echo "🐍 Python Version Requirements:"
echo "-------------------------------"
[ -f ".python-version" ] && echo "   .python-version: $(cat .python-version)"
[ -f "runtime.txt" ] && echo "   runtime.txt: $(cat runtime.txt)"
grep -i "python" requirements.txt 2>/dev/null | head -5 || echo "   (check requirements.txt manually)"

echo ""
echo "📦 Package Manager Files:"
echo "------------------------"
[ -f "Pipfile" ] && echo "   ✅ Pipfile (pipenv)"
[ -f "poetry.lock" ] && echo "   ✅ poetry.lock (poetry)"
[ -f "package.json" ] && echo "   ✅ package.json (npm/node)"

echo ""
echo "🔧 Build Configuration:"
echo "----------------------"
[ -f "CMakeLists.txt" ] && echo "   Uses CMake"
[ -f "Makefile" ] && echo "   Uses Make"
[ -f "build.py" ] && echo "   Uses Python build script"

echo ""
echo "📝 Summary saved to: $INVESTIGATION_DIR/shar-summary.txt"
{
    echo "SHAR Installation Investigation Summary"
    echo "======================================="
    echo "Date: $(date)"
    echo ""
    echo "Repository: $REPO_URL"
    echo "Location: $(pwd)"
    echo ""
    echo "Files Found:"
    ls -1 | head -20
    echo ""
    echo "--- README.md (first 50 lines) ---"
    [ -f "README.md" ] && head -50 README.md
    echo ""
    echo "--- requirements.txt ---"
    [ -f "requirements.txt" ] && cat requirements.txt
} > "$INVESTIGATION_DIR/shar-summary.txt"

echo ""
echo "✅ Investigation complete!"
echo "   Check the summary at: $INVESTIGATION_DIR/shar-summary.txt"
echo "   Repository cloned at: $(pwd)"
