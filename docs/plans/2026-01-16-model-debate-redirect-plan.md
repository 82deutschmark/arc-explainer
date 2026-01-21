# 2026-01-16 Model Debate Redirect Plan

## Scope & Background
- User reports that navigating directly to `http://localhost:5000/debate/31f7f899` no longer loads Model Debate content.
- Hypothesis: route-level data dependencies and/or SSR fallback broke after recent changes; short-term remediation could be redirecting `/debate/:taskId` to the stable `/puzzle/:taskId` page.
- Need to confirm whether front-end routing, Express SPA fallback, or API responses caused the regression.

## Objectives
1. Reproduce and isolate the failure (log console/network behavior, inspect server responses).
2. Identify whether `/debate/:taskId` should be restored or intentionally redirected.
3. Implement the agreed fix (likely redirect to `/puzzle/:taskId`) without breaking other routes.
4. Update docs/CHANGELOG and add regression coverage if feasible (e.g., route test or Cypress note).

## Proposed Tasks / TODOs
1. **Investigation**
   - Inspect client-side route (`client/src/App.tsx`) plus `ModelDebate` page for data fetch expectations.
   - Verify Express SPA fallback (dev via `server/vite.ts`, prod via `server/index.ts`) properly serves `/debate/:taskId`.
   - Check network/API logs when hitting `/debate/:taskId`.
2. **Decision & Fix**
   - If restoring Model Debate is low-effort, patch the bug (e.g., ensure puzzle fetch tolerates missing data).
   - If consensus is redirect, add explicit route-level redirect (server + client) so `/debate/:taskId` forwards to `/puzzle/:taskId`.
3. **Verification**
   - Manually test navigating to `/debate/31f7f899` (direct load + in-app navigation) to confirm redirect/behavior.
   - Run relevant automated tests (unit/integration) if modified codepaths have coverage; otherwise, add targeted tests.
4. **Documentation**
   - Update CHANGELOG (top entry) describing behavior change and rationale.
   - Note redirect behavior in appropriate docs if lasting (e.g., `docs/reference/frontend/DEV_ROUTES.md`).

## Open Questions
- Should `/debate` root still list hardest puzzles, or should it also redirect? (Pending user guidance.)
- Any downstream features (e.g., share links) relying on `/debate/:taskId`? Need to ensure redirect preserves query params.

Pending user approval before making code changes.
