FROM node:20-alpine

# Dockerfile for ARC Explainer app runtime and build
# - Builds the client and server
# - Adds Python 3 for Saturn Visual Solver and Poetiq Meta-System Solver
# - Poetiq solver is INTERNALIZED at solver/poetiq/ (always available)
# - BeetreeARC and SnakeBench submodules are INITIALIZED during build
# Author: Cascade (Claude Sonnet 4)
# Updated: 2025-12-02 - Initialize git submodules during Docker build

# Add Python3, git, and canvas dependencies
RUN apk add --no-cache \
    python3 py3-pip \
    git \
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
RUN python3 -m pip install --no-cache-dir --break-system-packages -r requirements.txt

# Install dependencies
RUN npm ci

# Copy git metadata and initialize submodules
COPY .git .git
COPY .gitmodules .gitmodules
RUN echo "=== INITIALIZING GIT SUBMODULES ===" && \
    git submodule update --init --recursive --force

# Copy all source code (now including initialized submodules)
COPY . .

# Install beetreeARC dependencies (now required since we initialize submodules)
RUN echo "=== INSTALLING BEETREEARC DEPENDENCIES ===" && \
    test -f beetreeARC/src/solver_engine.py && echo "✓ beetreeARC solver_engine.py exists" || (echo "✗ beetreeARC solver_engine.py NOT FOUND" && exit 1) && \
    test -f beetreeARC/requirements.txt && echo "✓ beetreeARC requirements.txt exists" || (echo "✗ beetreeARC requirements.txt NOT FOUND" && exit 1) && \
    python3 -m pip install --no-cache-dir --break-system-packages -r beetreeARC/requirements.txt

# Install SnakeBench dependencies (now required since we initialize submodules)
RUN echo "=== INSTALLING SNAKEBENCH DEPENDENCIES ===" && \
    test -f external/SnakeBench/backend/main.py && echo "✓ SnakeBench backend main.py exists" || (echo "✗ SnakeBench backend main.py NOT FOUND" && exit 1) && \
    test -f external/SnakeBench/backend/requirements.txt && echo "✓ SnakeBench backend requirements.txt exists" || (echo "✗ SnakeBench backend requirements.txt NOT FOUND" && exit 1) && \
    python3 -m pip install --no-cache-dir --break-system-packages -r external/SnakeBench/backend/requirements.txt

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

EXPOSE 5000
CMD ["node", "dist/index.js"]
