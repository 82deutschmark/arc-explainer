#!/bin/bash
# Setup script for Poetiq solver dependencies
# Updated 2025-11-27: Poetiq is now INTERNALIZED at solver/poetiq/ (no submodule)
# Author: Cascade (Claude Sonnet 4)

echo "Setting up Poetiq solver..."

# Check if INTERNALIZED solver exists at solver/poetiq/
if [ ! -d "solver/poetiq" ] || [ ! -f "solver/poetiq/solve.py" ]; then
    echo "ERROR: Poetiq solver not found at solver/poetiq/"
    echo "The Poetiq solver should be internalized at solver/poetiq/"
    echo "Required files: solve.py, llm.py, types.py, config.py, etc."
    exit 1
else
    echo "✓ Poetiq solver found at solver/poetiq/"
    ls -la solver/poetiq/*.py
fi

# Verify Python dependencies
echo ""
echo "Checking Python dependencies..."
if python3 -c "import litellm; import asynciolimiter" 2>/dev/null; then
    echo "✓ litellm and asynciolimiter available"
else
    echo "Installing Python dependencies from requirements.txt..."
    pip install -r requirements.txt
fi

echo ""
echo "Poetiq setup complete."
