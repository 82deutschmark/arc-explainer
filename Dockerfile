FROM node:18-alpine

# Dockerfile for ARC Explainer app runtime and build
# - Builds the client and server
# - Adds Python 3 to run `server/python/saturn_wrapper.py` for Saturn Visual Solver
# Author: Cascade (model: GPT-5 medium reasoning)

# Add Python3 for Saturn integration
RUN apk add --no-cache python3 py3-pip

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Copy Python requirements for Saturn and install them
COPY requirements.txt ./
RUN python3 -m pip install --no-cache-dir --break-system-packages -r requirements.txt

# Install dependencies
RUN npm ci

# Copy source code and ALL config files needed for build
COPY client/ ./client/
COPY server/ ./server/
COPY shared/ ./shared/
COPY data/ ./data/
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./

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
    echo "=== CHECKING CSS ===" && \
    ls -la dist/public/assets/ && \
    echo "=== INSPECTING CSS CONTENT ===" && \
    head -n 20 dist/public/assets/*.css

EXPOSE 5000
CMD ["node", "dist/index.js"]
