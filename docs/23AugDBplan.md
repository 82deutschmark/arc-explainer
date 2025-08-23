Key issues
dbService.ts

Monolithic scope:
Connection init, schema creation/migrations, CRUD for explanations/feedback, stats queries, and batch-run ops live in one module.
Hard to unit test; any import drags a DB and migration side‑effects.
Ad‑hoc migrations:
DO $$ blocks conditionally altering columns in runtime code. Risky in prod, opaque history, hard to roll back.
saturn_events references saturn_log(id) but saturn_log table isn’t created—broken FK.
Inconsistent/weak typing:
Lots of any (providerRawResponse, reasoningItems). normalizeConfidence(confidence: any).
Return shapes from SELECTs not typed; downstream can break silently.
Data modeling mismatches:
JSON serialized into TEXT columns (saturn_images, predicted_output_grid) in some places; JSONB would be better and avoids manual stringify/parse.
Mixed TIMESTAMP/TIMESTAMPTZ and NOW() defaults—be consistent (prefer TIMESTAMPTZ + now()).
api_processing_time_ms as INTEGER; long runs could overflow—use BIGINT.
vote_type as VARCHAR with CHECK; consider a real ENUM or a small lookup table.
Performance smells:
Repeated correlated subqueries to count feedback; prefer one aggregated join with COUNT(*) FILTER.
getBulkExplanationStatus uses two SELECT COUNT(*) subqueries per row; can be flattened.
Safety/ops:
DATABASE_URL used without SSL options; Railway often needs ssl: { rejectUnauthorized: false } in prod.
Global Pool without graceful shutdown; no pool.end() hook.
updateBatchRun builds SET from arbitrary keys—whitelist allowed columns.
API/behavior quirks:
RAW_RESPONSE_PERSIST defaults to true when unset; surprising prod default. Document or default to false.
normalizeConfidence defaulting to 50 on bad input may mask errors; consider null + validation.
Logger tag sometimes omitted; standardize logger.info(..., 'database').
Consistency gaps:
getExplanationForPuzzle returns saturn_images as raw TEXT (JSON string) while other getters parse it—make behavior consistent.
Naming: DB snake_case vs TS camelCase is fine, but keep consistent aliasing.
Schema constraints/indexes:
Many nullable fields that probably shouldn’t be (e.g., puzzle_id is fine, but model_name?).
feedback.explanation_id lacks ON DELETE CASCADE (consider if explanations can be pruned).
Missing indexes for common filters/sorts: explanations(puzzle_id, created_at), feedback(explanation_id), explanations(model_name), explanations(is_prediction_correct), batch_results(batch_run_id).
Suggested modularization

db/connection.ts
createPool({ connectionString, ssl }); export query(), with optional graceful shutdown.
db/migrations/
Use a proper tool (node-pg-migrate/Drizzle/Prisma/Knex). Versioned, idempotent migrations. Remove createTablesIfNotExist from runtime path.
db/repositories/
explanationsRepo.ts: save/get/getById/getAllForPuzzle/has/bulkStatus.
feedbackRepo.ts: add/getForExplanation/getForPuzzle/getAllWithFilters/summaryStats.
statsRepo.ts: accuracy/leaderboard queries only.
batchRepo.ts: runs and results CRUD.
saturnRepo.ts: saturn_* fields/events if needed.
services/
statsService.ts: compose repo queries; return typed DTOs.
batchService.ts: orchestration logic around runs/results.
utils/
confidence.ts: normalizeConfidence(number|string): number|null with explicit validation.
typing: shared zod schemas for row <-> DTO mapping.
Data model adjustments (migrations)

explanations
saturn_images JSONB NULL.
predicted_output_grid JSONB NULL.
provider_raw_response JSONB NULL (keep).
reasoning_items JSONB NULL (keep).
api_processing_time_ms BIGINT.
created_at TIMESTAMPTZ DEFAULT now().
Add indexes: (puzzle_id, created_at DESC), (model_name), (is_prediction_correct), (created_at).
feedback
created_at TIMESTAMPTZ DEFAULT now().
vote_type as ENUM helpful|not_helpful (or keep CHECK).
FK feedback.explanation_id ON DELETE CASCADE (if acceptable).
Index: (explanation_id), (created_at).
batch_runs/results
Ensure BIGINT for total_processing_time_ms; indexes on (created_at DESC), results(batch_run_id, processed_at).
saturn_events
Either create saturn_log table or change FK to explanations(id) or drop FK. Add created_at TIMESTAMPTZ and index on (request_id).
Query refactors (sketches)

Replace feedback counts in SELECT with aggregated join:
LEFT JOIN LATERAL or JOIN feedback f ON f.explanation_id=e.id
SELECT COUNT() FILTER (WHERE f.vote_type='helpful') AS helpful_votes, COUNT() FILTER (...) AS not_helpful_votes
Bulk latest explanation per puzzle:
DISTINCT ON (puzzle_id) ... ORDER BY puzzle_id, created_at DESC
Then LEFT JOIN aggregated feedback.
API/typing improvements

Define row types and DTOs; validate JSONB fields on read; no any.
Make saveExplanation accept a zod-validated payload; reject bad confidence instead of coercing to 50.
Parse JSONB via pg types (node-pg can auto-cast) to avoid manual JSON.parse everywhere.
Operational improvements

Add initDb to only verify connectivity; remove schema changes from app boot.
Expose isConnected(), end() for tests/shutdown.
Add SSL config based on NODE_ENV/RAILWAY_ENV.
Minor cleanups

Consolidate logger calls with consistent tags.
Default modelName to unknown is fine; consider NOT NULL with default 'unknown'.
Prefer pool.query(...) instead of pool.connect() for simple one-offs to reduce boilerplate.
Hardcoded/placeholder finds

'unknown' modelName default.
Logger tag sometimes omitted.
RAW_RESPONSE_PERSIST default behavior.
FK to saturn_log without table.
Many literal SQL snippets—extract common identifiers/constants.
Bottom line

Split this into connection + migrations + repositories + services. Remove runtime migrations, fix the saturn_log FK, convert TEXT-JSON to JSONB, add indexes, and tighten types/validation. This will cut brittleness, improve performance, and make future schema changes safe.