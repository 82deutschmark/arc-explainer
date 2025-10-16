# 2025-10-16 Fix TypeScript errors plan

## Goal
Resolve outstanding TypeScript compilation errors reported in `npm run check` by cleaning up unused jjosh service and aligning OpenAI streaming event handling with current SDK typings.

## Tasks
- [x] Confirm current TypeScript errors via `npm run check`.
- [x] Decide whether to remove or refactor `server/services/jjosh.ts` since it's unused and breaking the build.
- [x] Update `server/services/aiServiceFactory.ts` to reflect jjosh service removal so factory remains type-safe.
- [x] Adjust `server/services/openai.ts` streaming handler to align with available event discriminants and avoid accessing non-existent fields.
- [x] Re-run `npm run check` to ensure the codebase compiles cleanly.
