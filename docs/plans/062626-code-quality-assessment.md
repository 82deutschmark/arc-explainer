<!--
Author: Claude Sonnet 4.6
Date: 2026-06-26
PURPOSE: Full-codebase architecture, testing, and hygiene assessment. Documents concrete findings
         and prioritized remediation steps for the arc-explainer hobby project. Reference document
         for future cleanup sessions — no code changes are part of this plan.
SRP/DRY check: Pass — read-only assessment, no new code introduced.
-->

# Code Quality Assessment — June 26, 2026

Comprehensive top-to-bottom review of architecture, security posture, testing quality, and code
hygiene. Conducted by reading routes, controllers, services, repositories, tests, and configuration.
Scope: arc-explainer as a ~4-5 user hobby project deployed on Railway.

---

## Overall Verdict

**Not swiss cheese.** The project has a real architecture (repository pattern, controller/service
split, typed throughout with `strict: true`, centralized error handling, transactional migrations).
The most common catastrophic holes in AI-assisted projects — SQL injection, no type system, all
logic in route handlers, no error handling, no migrations — are not present here.

Real holes exist but are mostly deliberate decisions for a hobby context, not accidental omissions.
The two that matter most are documented below.

---

## Security Findings

### CRITICAL: Admin endpoints have no authentication

All `/api/admin/*` routes are fully public. `POST /api/admin/start-ingestion`,
`POST /api/admin/openrouter/import`, `GET /api/admin/quick-stats`, and the full data recovery
surface are callable by anyone who discovers the URL.

`server/middleware/apiKeyAuth.ts` exists but its header explicitly says:
```
⚠️ WARNING: DO NOT USE THIS MIDDLEWARE! ⚠️  ALL ENDPOINTS MUST BE PUBLIC!
```
The import is commented out in `server/routes.ts` (line 55-56). The file also contains hardcoded
demo keys (`'arc-explainer-admin-key-2025'`, `'demo-api-key-for-researchers'`, etc.) as dead code.

**Risk level for a 4-5 user hobby project:** Low in practice, but worth addressing before any
wider sharing. Anyone who finds the API can trigger HuggingFace dataset ingestion or OpenRouter
model syncs.

**Fix:** Add an environment-variable-backed auth check (`process.env.ADMIN_API_KEY`) as middleware
on the `/api/admin` prefix. Delete the dead hardcoded keys from `apiKeyAuth.ts`.

### HIGH: No rate limiting on streaming endpoints

`POST /api/stream/analyze` triggers real AI API calls (OpenAI, Anthropic, xAI, etc.) with no rate
limiter. The RE-ARC generation/evaluation endpoints do have rate limiting (5/5min, 50/5min), but
the main analysis path — which burns API credits — does not.

**Fix:** Apply rate limiting to `/api/stream/analyze` matching the RE-ARC pattern. 10 req/5min
per IP is a reasonable starting point.

### MEDIUM: Hardcoded `'test'` bypass in `streamController.ts`

```typescript
const isTestBypass = userApiKey === 'test';  // streamController.ts ~line 285
```

This bypasses BYOK enforcement in production when someone passes the string `'test'` as their API
key. There is no environment gate.

**Fix:** Remove entirely, or wrap in `if (process.env.NODE_ENV === 'development')`.

---

## Architecture

### What's working well

- **Repository pattern is clean.** No SQL in controllers. The layer separation —
  `controller → service → repository → BaseRepository → pool` — is consistently maintained
  across the entire server.
- **`BaseRepository`** handles pool singleton, progressive retry (2s/4s/6s), per-client error
  listeners to prevent crashes, transaction support with ROLLBACK, and delegates shared utilities
  (`safeJsonParse`, `sanitizeGridData`, etc.) to `CommonUtilities`. Solid.
- **Parameterized SQL throughout.** 177+ `$1/$2/$3` parameterized placeholders found. No string
  interpolation into queries detected.
- **`asyncHandler` wrapper on all routes.** Async errors propagate to the centralized error handler
  (`server/middleware/errorHandler.ts`) consistently.
- **Schema migrations are transactional and additive.** `DatabaseSchema.ts` wraps all three phases
  (CREATE TABLE IF NOT EXISTS, ALTER TABLE migrations, data backfills) in a single transaction.
- **CHANGELOG discipline is exceptional.** 4000+ lines of what/why/how/files-changed entries.

### SRP violations — controllers doing too much

| File | Size | Distinct responsibilities |
|------|------|--------------------------|
| `server/controllers/adminController.ts` | 25KB | Stats + HuggingFace ingestion + OpenRouter sync + data recovery |
| `server/controllers/snakeBenchController.ts` | 32KB | Game state + streaming + leaderboard + SnakeBench API (32 handlers) |
| `server/controllers/poetiqController.ts` | 32KB | SSE stream lifecycle + solver orchestration (duplicates `streamController.ts` patterns) |

**Recommendation:** Split `adminController.ts` into `AdminDashboardController`,
`IngestionController`, `OpenRouterSyncController`. Each has a clear, separate reason to change.
The snake/poetiq controllers are lower priority but should be split if either grows further.

### Provider code duplication

Six AI providers each independently reimplement the same three patterns:

1. **`callProviderAPI`** — build payload → call HTTP/SDK → normalize response
2. **`parseProviderResponse`** — extract token usage, build `PuzzleAnalysis`
3. **`getDefaultMaxTokens`** — hardcoded per-model token limits

Provider file sizes reflect the duplication: `grok.ts` (778 lines), `openrouter.ts` (766),
`anthropic.ts` (466), `gemini.ts` (401), `deepseek.ts` (363). Only OpenAI has been refactored
into modular files under `server/services/openai/`.

Stream aggregation classes are also copy-pasted: `GrokStreamAggregates` is structurally identical
to `OpenAIStreamAggregates` with no shared base type.

**Recommendation:** Push `callProviderAPI`, `parseProviderResponse`, and token limit logic as
template methods into `BaseAIService`. Per-provider implementations supply only the genuinely
different pieces (payload shape, endpoint, auth header). This is the highest-leverage refactor
available.

### `AIServiceFactory` routing is fragile

`server/services/ai/AIServiceFactory.ts` uses nested string prefix matching. The check
`normalized.includes('/')` (intended to detect OpenRouter models) would incorrectly match
Anthropic model names like `anthropic/claude-3-7-sonnet`. A typo in a model name silently falls
through to OpenAI rather than throwing.

**Recommendation:** Use an explicit prefix registry `[{ prefix: 'grok/', service: grokService }]`
iterated in order, and throw on unrecognized model names rather than defaulting.

### Inline business logic in `routes.ts`

The visitor counter and `POST /api/admin/recover-multiple-predictions` have ~50 lines of actual
business logic (JSON parsing, loops over DB rows, grid validation) as inline lambdas in `routes.ts`
rather than in controllers. This makes the file inconsistent — some endpoints use controller
methods, others embed logic directly.

**Recommendation:** Move all inline handlers to controllers. The routes file should be a pure
routing table.

---

## Testing

### What's working well

- 28 test files covering real logic: harness scoring math, repository behavior, streaming event
  handling, prompt builder correctness, feature flags, SSE, OpenRouter, explanation repository.
- Tests use meaningful assertions (e.g. scoring tests verify exact arithmetic against the official
  Python implementation).
- Mock infrastructure for Express response lifecycle is well-constructed.

### Issues

**Production code has test seams baked in.**
`server/services/reArc/reArcService.ts` exports `__testOnly_datasetCache`. This is a symptom of
the cache not being injectable. Fix: accept the cache as a constructor dependency; tests pass a
fresh instance, production passes the singleton.

**Environment variable mutation without cleanup.**
`tests/reArcController.test.ts` sets `process.env.RE_ARC_DEV_MODE` without `try/finally`. If an
assertion throws before cleanup, subsequent tests run with corrupted environment.
Fix: use `vi.stubEnv()` (Vitest restores automatically) or an `afterEach` restore.

**Mocking concrete objects instead of interfaces.**
`tests/aiServiceFactory.test.ts` mocks the factory with `{ name: 'openai' }` — a plain object
with no type relationship to the actual service interface. If `IAIService` gains a required method,
the test compiles and passes while being wrong.
Fix: define an `IAIService` interface and mock against it.

**No error path coverage on Python integration.**
`tests/reArcService.test.ts` covers the happy path only. No tests for: Python binary not found,
subprocess exit non-zero, malformed JSON, generation timeout.
Fix: add at minimum one test where the subprocess fails and verify a typed error is thrown.

**Mixed assertion styles.**
Some tests use `expect` (Vitest), others use `assert` (Node built-in). Pick one. Vitest's `expect`
is already the dominant pattern.

**Trivially true assertions.**
`tests/analysisStreamService.test.ts` stores a payload and immediately asserts the stored `taskId`
matches the input `taskId`. This proves the test infrastructure works, not the service.

---

## Code Hygiene

### `BaseAIService` — the root — is typed `any`

The base class used by all 6 providers has these `any` declarations:
```typescript
reasoningLog: any;
[key: string]: any;         // on AIResponse
parseProviderResponse(): { result: any, ... }
getSchemaForModel(): any | null
```

Because every provider inherits from `BaseAIService`, this `any` propagates through the entire AI
layer. Tightening these three types fixes 6 files at once.

**Fix:** Define `ReasoningLog`, `AIResponse<T>`, and `StructuredOutputSchema` as concrete types.
Start with the base class.

### `promptBuilder.ts` — structured output hardcoded to `false`

Four unresolved TODOs in `server/services/prompts/promptBuilder.ts`, including:
```typescript
const hasStructuredOutput = false;  // TODO: Add to ServiceOptions interface
```

This means structured output is silently disabled for every request regardless of model capability.
The feature exists in the model config but never activates.

**Fix:** Add `hasStructuredOutput` to `ServiceOptions` and thread it through. This is a feature
gap, not just hygiene.

### Vision support detection is broken

```typescript
// server/services/anthropic.ts
supportsVision: modelName.includes('claude-3')
```

Claude 3.5 and 3.7 Sonnet both support vision, but this returns `false` for them.

**Fix:** Move `supportsVision` into model config metadata (`server/config/models.ts`) and derive
from there, not from string matching.

### Backup files tracked in git

`server/services/beetreeService.ts.backup2` and `server/services/beetreeService_fixed.ts` are
tracked in the repository.

**Fix:** Delete both files. Add `*.backup*` and `*_fixed.ts` patterns to `.gitignore` if desired.

### Import style inconsistency in `routes.ts`

The routes file mixes `.ts` and `.js` extensions and both named and namespace import styles:
```typescript
import adminController, * as adminControllerFns from './controllers/adminController.js';  // .js + namespace
import { streamController } from "./controllers/streamController.ts";                       // .ts + named
```
Not broken (bundler handles both), but a clear sign of multiple AI authors without a cleanup pass.

### `console.error` in `errorHandler.ts`

`server/middleware/errorHandler.ts` uses `console.error` rather than the project's `logger`.
Errors caught by the central handler are the most important ones to have in structured logs.

**Fix:** Replace `console.error` with `logger.logError`.

---

## Prioritized Remediation List

### Quick wins (under 30 minutes each)

1. Remove `userApiKey === 'test'` bypass in `streamController.ts`
2. Delete `beetreeService.ts.backup2` and `beetreeService_fixed.ts`
3. Replace `console.error` with `logger.logError` in `errorHandler.ts`
4. Fix `supportsVision` to use model config rather than `includes('claude-3')`

### Medium effort (a few hours each)

5. Fix `hasStructuredOutput = false` in `promptBuilder.ts` — add to `ServiceOptions` interface
6. Fix env var cleanup in tests — use `vi.stubEnv()` throughout
7. Define `IAIService` interface and update factory tests to mock against it
8. Add error-path tests for Python subprocess integration
9. Add admin route auth middleware (env-var backed `ADMIN_API_KEY`)
10. Apply rate limiting to `/api/stream/analyze`

### Larger refactors (half-day to multi-day)

11. Type `BaseAIService` response interfaces — replace `any` with concrete types
12. Extract `callProviderAPI` and `parseProviderResponse` template methods into `BaseAIService`
13. Split `adminController.ts` into three focused controllers
14. Move inline route lambdas to controllers in `routes.ts`
15. Refactor `AIServiceFactory` to use an explicit prefix registry

---

## What This Project Is Not

For calibration: the "swiss cheese" critique assumes these common holes which are all absent here:

- SQL string concatenation (injection) — not present
- No type system — TypeScript strict mode throughout
- All logic in route handlers — proper repository/service/controller split
- No error handling — asyncHandler + centralized handler + AppError
- No migration system — transactional schema migrations with 3-phase structure
- No tests — 28 test files on real logic

The gaps that exist are concentrated in three areas: security on admin endpoints, type completeness
in the AI service layer, and test coverage for error paths. All are addressable.
