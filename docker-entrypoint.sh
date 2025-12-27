#!/bin/sh
# Author: Claude Haiku 4.5
# Date: 2025-12-25
# PURPOSE: Start both crond for scheduled catalog sync and the Node.js app
# SRP/DRY check: Pass - single responsibility of orchestrating processes

# Start crond in the background
echo "[ENTRYPOINT] Starting crond daemon..."
crond -f -l 2 &

# Start the Node app in the foreground (Docker will manage it)
echo "[ENTRYPOINT] Starting Node app..."
exec node dist/index.js
