FROM node:20-alpine

# Dockerfile for ARC Explainer app runtime and build
# - Builds the client and server
# - Adds Python 3 for Saturn Visual Solver and Poetiq Meta-System Solver
# - Poetiq solver is INTERNALIZED at solver/poetiq/ (always available)
# - BeetreeARC and SnakeBench code are ensured via submodules when present, or shallow git clones during build
# Author: Cascade (Claude Sonnet 4)
# Updated: 2026-02-06 - Add ARCEngine clone fallback when submodule contents are absent in CI build contexts

# Add Python3, git, canvas dependencies, and cron daemon for scheduled tasks
RUN apk add --no-cache \
    python3 py3-pip \
    git \
    dcron \
    pkgconf \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev \
    build-base \
    g++ \
    make

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Copy Python requirements for Saturn, Poetiq, and BeetreeARC and install them
COPY requirements.txt ./
# Ensure beetreeARC requirements placeholder exists so pip include succeeds even before submodule clone
RUN mkdir -p beetreeARC && \
    if [ ! -f beetreeARC/requirements.txt ]; then \
        echo "# placeholder for beetreeARC requirements (real file copied later)" > beetreeARC/requirements.txt; \
    fi && \
    python3 -m pip install --no-cache-dir --break-system-packages -r requirements.txt

# Install dependencies
RUN npm ci

# Copy all source code (submodules may or may not be present in build context)
COPY . .

# Prepare beetreeARC: use existing checkout if present, otherwise clone from GitHub
RUN echo "=== PREPARING BEETREEARC SUBMODULE ===" && \
    if [ ! -f beetreeARC/src/solver_engine.py ]; then \
        echo "\u2717 beetreeARC not present in build context; cloning from GitHub" && \
        rm -rf beetreeARC && \
        git clone --depth 1 https://github.com/82deutschmark/beetreeARC beetreeARC; \
    else \
        echo "\u2713 beetreeARC present in build context; using existing checkout"; \
    fi && \
    test -f beetreeARC/src/solver_engine.py && echo "\u2713 beetreeARC solver_engine.py exists" || (echo "\u2717 beetreeARC solver_engine.py NOT FOUND after clone" && exit 1) && \
    test -f beetreeARC/requirements.txt && echo "\u2713 beetreeARC requirements.txt exists" || (echo "\u2717 beetreeARC requirements.txt NOT FOUND after clone" && exit 1) && \
    echo "=== INSTALLING BEETREEARC DEPENDENCIES ===" && \
    python3 -m pip install --no-cache-dir --break-system-packages -r beetreeARC/requirements.txt

# Prepare SnakeBench backend: use existing checkout if present, otherwise clone from GitHub
RUN echo "=== PREPARING SNAKEBENCH BACKEND ===" && \
    if [ ! -f external/SnakeBench/backend/main.py ]; then \
        echo "\u2717 SnakeBench backend not present in build context; cloning from GitHub" && \
        rm -rf external/SnakeBench && \
        mkdir -p external && \
        git clone --depth 1 https://github.com/VoynichLabs/SnakeBench external/SnakeBench; \
    else \
        echo "\u2713 SnakeBench backend present in build context; using existing checkout"; \
    fi && \
    test -f external/SnakeBench/backend/main.py && echo "\u2713 SnakeBench backend main.py exists" || (echo "\u2717 SnakeBench backend main.py NOT FOUND after clone" && exit 1) && \
    test -f external/SnakeBench/backend/requirements.txt && echo "\u2713 SnakeBench backend requirements.txt exists" || (echo "\u2717 SnakeBench backend requirements.txt NOT FOUND after clone" && exit 1) && \
    echo "=== INSTALLING SNAKEBENCH BACKEND DEPENDENCIES ===" && \
    python3 -m pip install --no-cache-dir --break-system-packages -r external/SnakeBench/backend/requirements.txt

# Prepare re-arc: use existing checkout if present, otherwise clone from GitHub
RUN echo "=== PREPARING RE-ARC LIBRARY ===" && \
    if [ ! -f external/re-arc/lib.py ]; then \
        echo "\u2717 re-arc not present in build context; cloning from GitHub" && \
        rm -rf external/re-arc && \
        mkdir -p external && \
        git clone --depth 1 https://github.com/conundrumer/re-arc external/re-arc; \
    else \
        echo "\u2713 re-arc present in build context; using existing checkout"; \
    fi && \
    test -f external/re-arc/lib.py && echo "\u2713 re-arc lib.py exists" || (echo "\u2717 re-arc lib.py NOT FOUND after clone" && exit 1)

# Prepare ARCEngine: use existing checkout if present, otherwise clone from GitHub
RUN echo "=== PREPARING ARCENGINE LIBRARY ===" && \
    if [ ! -f external/ARCEngine/arcengine/__init__.py ]; then \
        echo "\u2717 ARCEngine not present in build context; cloning from GitHub" && \
        rm -rf external/ARCEngine && \
        mkdir -p external && \
        git clone --depth 1 --branch main https://github.com/82deutschmark/ARCEngine external/ARCEngine; \
    else \
        echo "\u2713 ARCEngine present in build context; using existing checkout"; \
    fi && \
    test -f external/ARCEngine/arcengine/__init__.py && echo "\u2713 ARCEngine __init__.py exists" || (echo "\u2717 ARCEngine __init__.py NOT FOUND after clone" && exit 1) && \
    test -f external/ARCEngine/pyproject.toml && echo "\u2713 ARCEngine pyproject.toml exists" || (echo "\u2717 ARCEngine pyproject.toml NOT FOUND after clone" && exit 1) && \
    echo "=== INSTALLING ARCENGINE AS EDITABLE PACKAGE ===" && \
    cd external/ARCEngine && python3 -m pip install --no-cache-dir --break-system-packages -e .
# Poetiq solver is now internalized at solver/poetiq/ (copied above)
# Verify the internalized solver exists
RUN echo "=== VERIFYING INTERNALIZED POETIQ SOLVER ===" && \
    ls -la solver/poetiq/ && \
    test -f solver/poetiq/solve.py && echo "✓ solver/poetiq/solve.py exists" || (echo "✗ solver/poetiq/solve.py NOT FOUND" && exit 1) && \
    test -f solver/poetiq/llm.py && echo "✓ solver/poetiq/llm.py exists" || (echo "✗ solver/poetiq/llm.py NOT FOUND" && exit 1)

# Debug what files exist
RUN ls -la

# Build the app with extra debug output
RUN echo "=== ENVIRONMENT CHECK BEFORE BUILD ===" && \
    echo "Node version: $(node -v)" && \
    echo "NPM version: $(npm -v)" && \
    npm run build

# Verify files exist with detailed debug
RUN echo "=== CHECKING BUILD OUTPUT ===" && \
    ls -la dist/ && \
    ls -la dist/public/ && \
    echo "=== CHECKING index.html ===" && \
    ls -la dist/public/index.html && \
    echo "=== CHECKING ASSETS DIRECTORY ===" && \
    ls -la dist/public/assets/ && \
    echo "=== INSPECTING CSS CONTENT (IF PRESENT) ===" && \
    if ls dist/public/assets/*.css 1> /dev/null 2>&1; then head -n 20 dist/public/assets/*.css; else echo "No standalone CSS assets produced (styles likely injected via JS bundle)."; fi && \
    echo "=== INSPECTING JS BUNDLE ===" && \
    if ls dist/public/assets/*.js 1> /dev/null 2>&1; then head -n 20 dist/public/assets/*.js; else echo "No JS bundles present in assets directory (unexpected for Vite build)."; fi

# Set production environment for runtime
ENV NODE_ENV=production

# Copy crontab and entrypoint script for scheduled sync
# Source file lives under scripts/ in the repo
COPY scripts/crontab /etc/crontabs/root
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 5000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
