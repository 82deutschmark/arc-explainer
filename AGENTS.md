# Repository Guidelines
The ARC Explainer stack couples a Vite/React client with an Express + Drizzle backend and solver tooling. Use these guardrails, distilled from CLAUDE.md and the architecture docs, whenever you contribute.

## Project Structure & Module Organization
- `client/src` hosts pages, feature-scoped components, hooks, and shadcn/ui primitives extend what exists before adding new UI.
- `server` carries controllers, services, repositories, and websocket plumbing; shared DTOs live in `shared/`, datasets in `data/`, and solver bridges in `solver/`.
- Working notes belong in `docs/` as `{date}-{plan}-{goal}.md`; update analytics references when you touch reporting.

## Build, Test, and Development Commands
- `npm run dev` (or `npm run windows-dev`) starts the full stack; `npm run build` plus `npm run start` or `npm run prod` smoke-tests the bundle in `dist/`.
- `npm run check` enforces the TypeScript contract; `npm run db:push` syncs Drizzle migrations; solver utilities (`npm run ap`, `au`, `retry`) and `python server/python/saturn_wrapper.py --help` cover batch and visual pipelines.

## Coding Style, Naming, & Required Headers
- TypeScript everywhere with 2-space indentation, trailing commas, and ESM imports; components stay `PascalCase`, helpers follow existing camel or kebab patterns.
- Every new or edited file starts with the CLAUDE.md header (Author, Date, PURPOSE, SRP/DRY, shadcn/ui checks) and must prefer shadcn/ui over custom widgets.
- Secrets remain in `.env` or `configs/`; never embed provider keys or puzzle assets in source.

## Testing & Data Flow Expectations
- The product is database-first: PuzzleExaminer triggers analysis, `responseValidator` shapes outputs, `explanationService` saves, and hooks refetch from `/api/explanations`.
- Verify multi-test flows populate `multiple_predicted_outputs`, `multi_test_results`, and trustworthiness fields, and keep structured logging in place per `docs/25SeptQwenCoderLessons.md`.

## Analytics & Repository Practices
- Repositories are single-domain (Accuracy, Trustworthiness, Cost, etc.); aggregate with `repositoryService.metrics` instead of duplicating SQL.
- Always normalize model names via `utils/modelNormalizer.ts`, add indexes described in `docs/Analytics_Database_Architecture.md`, and let controllers combine data without inventing new business rules.

## Commit & Pull Request Guidelines
- Use concise imperative commits (`Fix multi-test validator`); reserve prefixes like `REVERT:` for true rollbacks.
- PRs outline intent, local test evidence (CLI logs or solver runs), linked issues or ARC puzzle IDs, and call out schema, logging, or contract changes that reviewers must mirror.
