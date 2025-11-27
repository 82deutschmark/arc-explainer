FROM node:20-alpine

# Dockerfile for ARC Explainer app runtime and build
# - Builds the client and server
# - Adds Python 3 for Saturn Visual Solver and Poetiq Meta-System Solver
# - Clones poetiq-solver submodule directly (submodules don't copy in Docker context)
# Author: Cascade (Claude Sonnet 4)
# Updated: 2025-11-27 - Added git for submodule cloning

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

# Copy Python requirements for Saturn and Poetiq and install them
COPY requirements.txt ./
RUN python3 -m pip install --no-cache-dir --break-system-packages -r requirements.txt

# Install dependencies
RUN npm ci

# Copy source code and ALL config files needed for build
COPY client/ ./client/
COPY server/ ./server/
COPY shared/ ./shared/
COPY solver/ ./solver/
COPY data/ ./data/
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./

# Clone poetiq-solver submodule directly (submodules don't work with COPY)
# This is a public repo so no auth needed
RUN echo "=== CLONING POETIQ-SOLVER SUBMODULE ===" && \
    git clone --depth 1 https://github.com/82deutschmark/poetiq-arc-agi-solver.git poetiq-solver && \
    echo "=== VERIFYING POETIQ-SOLVER ===" && \
    ls -la poetiq-solver/ && \
    ls -la poetiq-solver/arc_agi/ && \
    test -f poetiq-solver/arc_agi/solve.py && echo "✓ solve.py exists" || (echo "✗ solve.py NOT FOUND" && exit 1)

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
