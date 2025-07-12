FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm ci

# Copy source code (but NOT any existing dist/)
COPY client/ ./client/
COPY server/ ./server/
COPY shared/ ./shared/
COPY data/ ./data/
COPY tsconfig.json ./
COPY vite.config.ts ./

# Build the app
RUN npm run build

# Verify files exist (debug)
RUN echo "=== CHECKING BUILD OUTPUT ===" && \
    ls -la dist/ && \
    ls -la dist/public/ && \
    echo "index.html exists:" && \
    ls -la dist/public/index.html

EXPOSE 5000
CMD ["node", "dist/index.js"]
