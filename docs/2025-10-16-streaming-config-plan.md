# 2025-10-16 Streaming Config Plan

## Goals
- unify streaming configuration across backend and frontend using a shared `STREAMING_ENABLED` flag.
- document the new flag and update deployment manifests / env templates.
- add runtime visibility when frontend expects streaming but backend disables it.

## Steps
1. Inspect existing streaming feature flag usage on server (`analysisStreamService`) and client hooks to understand current env expectations.
2. Add a shared config helper (likely under `shared/` or similar) exposing a single `STREAMING_ENABLED` boolean defaulting to true in development, and update server + client to use it.
3. Update build tooling (e.g., Vite config) so the client receives the same flag value at build time from the unified source.
4. Amend documentation (`docs/reference/api/EXTERNAL_API.md`) and environment templates/manifests (`railway.json`, `vercel.json`, or `.env.example` if present) to reference the new flag.
5. Introduce a startup health check/log message warning when frontend streaming expectation and backend config diverge.
6. Run relevant tests / lint (if lightweight) and prepare documentation for the change.

## Notes
- Double-check for other references to `ENABLE_SSE_STREAMING` or `VITE_ENABLE_SSE_STREAMING` that may need to be migrated.
- Health check could live in server bootstrap or express app initialization; ensure it doesn't crash the app but surfaces a warning.
