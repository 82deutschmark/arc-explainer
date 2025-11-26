#!/bin/bash
# Setup script for Poetiq solver dependencies
# This script ensures Poetiq is available even if git submodule isn't initialized

echo "Setting up Poetiq solver..."

# Check if poetiq-solver directory exists and has the essential files
if [ ! -d "poetiq-solver/arc_agi" ] || [ ! -f "poetiq-solver/arc_agi/solve.py" ]; then
    echo "Poetiq submodule not found, creating minimal structure..."
    
    # Create the essential directory structure
    mkdir -p poetiq-solver/arc_agi
    
    # Create a simple placeholder that indicates Poetiq isn't available
    cat > poetiq-solver/arc_agi/__init__.py << 'EOF'
"""
Poetiq ARC-AGI Solver
This submodule should be initialized via: git submodule update --init --recursive
"""

__version__ = "1.0.0"
EOF
    
    echo "Created placeholder structure. Poetiq solver requires full submodule."
else
    echo "Poetiq solver found at poetiq-solver/"
fi

echo "Poetiq setup complete."
