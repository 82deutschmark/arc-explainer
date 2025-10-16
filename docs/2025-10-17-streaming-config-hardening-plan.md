# 2025-10-17 Streaming Config Hardening Plan

## Goals
- tighten the unified streaming configuration helper so legacy env vars trigger warnings even when shadowed by the new flag
- align repository metadata conventions (TypeScript headers, changelog) with project standards for the streaming follow-up

## Tasks
1. Review `shared/config/streaming.ts` to confirm legacy detection logic and update it to track any presence of deprecated keys across process/import meta envs.
2. Ensure the TypeScript header matches the mandated format when touching the shared helper.
3. Add a changelog entry for the follow-up fix (semver patch bump) capturing the diagnostic improvements.
4. Re-run `npm run check` to validate type safety after the refactor.
