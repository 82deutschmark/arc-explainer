# Remove newly added health checks

## Goal
Eliminate recently added health check routines that are triggering crashes during deployment.

## Scope
- `server/repositories/RepositoryService.ts`
- `server/controllers/feedbackController.ts`
- `server/routes.ts`
- `server/config/models/ModelCapabilities.ts`
- `server/config/models/index.ts`

## Tasks
1. Remove repository-wide health check helper and any controller endpoints that expose it.
2. Delete ad-hoc `/api/health/database` Express route.
3. Strip runtime health monitoring logic from the model capabilities module and simplify caching.
4. Update model configuration exports to reflect the removed health helpers.
5. Verify TypeScript builds locally if feasible.
