# SnakeBench MVP + Database Compatibility Plan

**Date:** 2025-12-09
**Goal:** Stabilize SnakeBench locally and in Railway while adding lightweight, **compatibility-first** database persistence that aligns with Greg's root SnakeBench project.

---

## TL;DR

1. **Phase 1 (MVP Hardening):** Make SnakeBench work reliably locally and in Railway with BYO API keys.
2. **Phase 2 (Light Persistence):** Add database tables that mirror `docs/SNAKE_BENCH_DB.md` exactly—not for building our own analytics, but for **storing local game history in a compatible format**.
3. **Phase 3 (Future):** Optional lightweight summaries; delegate serious analytics to Greg's SnakeBench project.

This keeps us lean while ensuring **our data can be merged with Greg's dataset without translation**.

---

## Current State

### ✅ Already Working (v5.35.x)

**Backend:**
- `server/services/snakeBenchService.ts` – Spawns Python, validates params, parses JSON output
- `server/python/snakebench_runner.py` – Bridge to SnakeBench backend
- `server/controllers/snakeBenchController.ts` – 5 HTTP endpoints (run-match, run-batch, games, games/:id, health)
- `external/SnakeBench` – Git submodule with fallback Docker clone
- `shared/types.ts` – SnakeBench types (lines 552–632)

**Frontend:**
- `client/src/pages/SnakeArena.tsx` – Match runner UI + embedded iframe
- `client/src/hooks/useSnakeBench.ts` – API wrappers

**Deployment:**
- `Dockerfile` – Python, submodule handling, SnakeBench deps
- Railway – Already uses Dockerfile, Python is available

### ❌ Not Yet Done

1. Local Python environment docs and setup scripts
2. BYO API key support (Poetiq-style)
3. `VITE_SNAKEBENCH_URL` usage in frontend
4. Database tables for game persistence
5. Model initialization from SnakeBench's model_list.yaml

---

## Phase 1: Local Development & Railway Hardening

### Goal
Any contributor can spin up SnakeBench locally; Railway deployments always include working SnakeBench backend.

### 1.1 – Submodule & Python Environment Docs

**File to update:** `docs/DEVELOPER_GUIDE.md` (or create `docs/SNAKEBENCH_SETUP.md`)

Add section:
```markdown
## SnakeBench Local Setup

1. Ensure submodule is initialized:
   git submodule update --init --recursive

2. Verify SnakeBench backend exists:
   ls external/SnakeBench/backend/main.py    # should exist
   ls external/SnakeBench/backend/requirements.txt

3. Install Python (required):
   - Windows: python --version (should be 3.x)
   - macOS/Linux: python3 --version

   Set PYTHON_BIN env var if non-standard:
   export PYTHON_BIN=python3  # or python

4. Install Python dependencies:
   pip install -r requirements.txt              # Arc Explainer shared deps
   pip install -r external/SnakeBench/backend/requirements.txt  # SnakeBench

5. Verify health:
   npm run dev
   curl http://localhost:5173/api/snakebench/health
   # Should see: { success: true, status: 'ok', ... }

6. Run a test match:
   POST http://localhost:5173/api/snakebench/run-match
   Body: { "modelA": "openrouter/meta-llama/llama-2-70b-chat", "modelB": "openrouter/mistralai/mistral-medium" }

   Verify games appear in: external/SnakeBench/backend/completed_games/
```

### 1.2 – Optional Setup Helper Script

**Files to create:**
- `scripts/setup-snakebench.sh` (macOS/Linux)
- `scripts/setup-snakebench.bat` (Windows)

Content (simplified example for `.sh`):
```bash
#!/bin/bash
set -e

echo "=== SnakeBench Setup ==="

# Check submodules
echo "Initializing git submodules..."
git submodule update --init --recursive

# Verify Python
PYTHON_BIN=${PYTHON_BIN:-python3}
echo "Checking Python..."
$PYTHON_BIN --version || { echo "Python not found. Install Python 3.x."; exit 1; }

# Install deps
echo "Installing Python dependencies..."
pip install -r requirements.txt
pip install -r external/SnakeBench/backend/requirements.txt

# Health check
echo "Testing SnakeBench health endpoint..."
# (Provide simple curl example or mention: start dev server and check manually)

echo "✓ SnakeBench setup complete."
```

### 1.3 – Verify Railway Build Logs

**Action:** Ensure Railway deployments always see these logs:

When Dockerfile runs:
```
=== PREPARING SNAKEBENCH BACKEND ===
[Either: Present in build context OR: Cloning from GitHub]
[Verify: backend/main.py exists]
[Verify: backend/requirements.txt exists]
=== INSTALLING SNAKEBENCH BACKEND DEPENDENCIES ===
[pip install -r external/SnakeBench/backend/requirements.txt completes]
```

If any step fails → build should fail (not silently skip SnakeBench).

---

## Phase 2: BYO API Keys & Environment Config

### Goal
Support bring-your-own API keys (like Poetiq) and respect `VITE_SNAKEBENCH_URL` for embedded UI.

### 2.1 – BYO API Key Support (Backend)

**File to modify:** `shared/types.ts`

Extend request types:
```typescript
export interface SnakeBenchRunMatchRequest {
  modelA: string;
  modelB: string;
  width?: number;
  height?: number;
  maxRounds?: number;
  numApples?: number;

  // NEW: BYO API key (optional, per-request)
  apiKey?: string;
  provider?: 'openrouter' | 'openai' | 'anthropic' | 'xai' | 'gemini';
}

export interface SnakeBenchRunBatchRequest extends SnakeBenchRunMatchRequest {
  count: number;
}
```

**File to modify:** `server/services/snakeBenchService.ts`

In `runMatch()` and `runBatch()`, when spawning Python:

```typescript
// Build env for subprocess
const env = {
  ...process.env,
  PYTHONIOENCODING: 'utf-8',
  PYTHONUTF8: '1',
};

// If BYO key provided, map provider → env var (Poetiq pattern)
if (request.apiKey && request.provider) {
  const providerEnvMap: Record<string, string> = {
    'openrouter': 'OPENROUTER_API_KEY',
    'openai': 'OPENAI_API_KEY',
    'anthropic': 'ANTHROPIC_API_KEY',
    'xai': 'XAI_API_KEY',
    'gemini': 'GEMINI_API_KEY',
  };
  const envKey = providerEnvMap[request.provider];
  if (envKey) {
    env[envKey] = request.apiKey;
    // Don't log the key itself; log only provider for observability
    logger.info(`SnakeBench: BYO key for provider=${request.provider}`);
  }
}

// Spawn with this env
const proc = spawn(PYTHON_BIN, [runner_path], { env });
```

**File to modify:** `server/controllers/snakeBenchController.ts`

Accept and pass through `apiKey` + `provider` from request body (don't log keys).

### 2.2 – Frontend BYO Key UI (Optional MVP)

**File to modify:** `client/src/pages/SnakeArena.tsx`

Add optional toggle/inputs:
```tsx
const [useBYOKey, setUseBYOKey] = useState(false);
const [provider, setProvider] = useState<'openrouter' | 'openai'>('openrouter');
const [apiKey, setApiKey] = useState('');

// When calling useSnakeBenchMatch:
useSnakeBenchMatch({
  modelA, modelB, width, height, maxRounds, numApples,
  ...(useBYOKey && { apiKey, provider }), // optional
});
```

**Security:** Keep API key in page-local state only; never localStorage or DB.

### 2.3 – `VITE_SNAKEBENCH_URL` Environment Variable

**File to modify:** `client/src/pages/SnakeArena.tsx`

Replace hardcoded URL:
```typescript
// OLD:
const SNAKEBENCH_URL = 'https://snakebench.com';

// NEW:
const SNAKEBENCH_URL = import.meta.env.VITE_SNAKEBENCH_URL ?? 'https://snakebench.com';
```

**Local development:** Add to `client/.env.local`:
```
VITE_SNAKEBENCH_URL=https://snakebench.com
```

**Railway staging/prod:** Set via Railway environment variables in UI, then rebuild client.

### 2.4 – Log & Observability

- Log `provider` and status for BYO runs; never log key material.
- If we later persist matches (Phase 3), optionally tag with `key_source` field (e.g. `'server' | 'byo'`) for filtering.

---

## Phase 3: Lightweight Database Persistence (Compatibility-First)

### Goal
Store local game history in PostgreSQL using the **exact schema from** `docs/SNAKE_BENCH_DB.md`. We're not building analytics here—just **compatible storage** so our data can eventually merge with Greg's SnakeBench dataset.

### 3.1 – Drizzle Schema Mapping

**File to modify:** `server/db/schema.ts`

Add three new tables—**exact 1:1 mapping** of `docs/SNAKE_BENCH_DB.md`:

```typescript
import { pgTable, bigserial, text, boolean, integer, doublePrecision, timestamp, jsonb, index, bigint } from 'drizzle-orm/pg-core';

// models table
export const snakeBenchModels = pgTable('models', {
  id: bigserial('id').primaryKey(),
  name: text('name').notNull(),
  provider: text('provider').notNull(),
  modelSlug: text('model_slug').notNull().unique(),

  isActive: boolean('is_active').notNull().default(false),
  testStatus: text('test_status').notNull().default('untested'), // 'untested', 'testing', 'ranked', 'retired'

  eloRating: doublePrecision('elo_rating').notNull().default(1500),
  wins: integer('wins').notNull().default(0),
  losses: integer('losses').notNull().default(0),
  ties: integer('ties').notNull().default(0),
  applesEaten: integer('apples_eaten').notNull().default(0),
  gamesPlayed: integer('games_played').notNull().default(0),

  pricingInput: doublePrecision('pricing_input'),
  pricingOutput: doublePrecision('pricing_output'),
  maxCompletionTokens: integer('max_completion_tokens'),
  metadataJson: jsonb('metadata_json'),

  lastPlayedAt: timestamp('last_played_at', { withTimezone: true }),
  discoveredAt: timestamp('discovered_at', { withTimezone: true }).notNull().defaultNow(),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  idxModelsActiveStatus: index('idx_models_active_status').on(table.isActive, table.testStatus),
  idxModelsName: index('idx_models_name').on(table.name),
}));

// games table
export const snakeBenchGames = pgTable('games', {
  id: text('id').primaryKey(), // game_id from SnakeBench

  status: text('status').notNull().default('queued'), // 'queued', 'in_progress', 'completed'
  startTime: timestamp('start_time', { withTimezone: true }),
  endTime: timestamp('end_time', { withTimezone: true }),
  rounds: integer('rounds'),

  replayPath: text('replay_path'),
  boardWidth: integer('board_width'),
  boardHeight: integer('board_height'),
  numApples: integer('num_apples'),

  totalScore: integer('total_score'),
  totalCost: doublePrecision('total_cost').default(0),
  gameType: text('game_type').notNull().default('ladder'), // 'ladder', 'evaluation'

  currentState: jsonb('current_state'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  idxGamesStatus: index('idx_games_status').on(table.status),
  idxGamesGameType: index('idx_games_gametype').on(table.gameType),
}));

// game_participants table
export const snakeBenchGameParticipants = pgTable('game_participants', {
  gameId: text('game_id').notNull().references(() => snakeBenchGames.id, { onDelete: 'cascade' }),
  modelId: bigint('model_id').notNull().references(() => snakeBenchModels.id, { onDelete: 'cascade' }),
  playerSlot: integer('player_slot').notNull(),

  score: integer('score').notNull().default(0),
  result: text('result').notNull().default('tied'), // 'won', 'lost', 'tied'
  deathRound: integer('death_round'),
  deathReason: text('death_reason'),
  cost: doublePrecision('cost').notNull().default(0),

  opponentRankAtMatch: integer('opponent_rank_at_match'),

  primaryKey: ['game_id', 'player_slot'],
}, (table) => ({
  idxGameParticipantsModel: index('idx_game_participants_model').on(table.modelId),
}));
```

**Key decisions:**
- Column names, types, defaults match `docs/SNAKE_BENCH_DB.md` exactly.
- No ARC-Explainer-specific columns added (we use `metadataJson` and `currentState` JSONB fields if needed).
- Foreign key relationships intact.

Then run:
```bash
npm run db:push
```

### 3.2 – Model Initialization from SnakeBench YAML

**File to create:** `server/scripts/initSnakeBenchModels.ts`

```typescript
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { db } from '../db/client';
import { snakeBenchModels } from '../db/schema';

async function main() {
  const modelListPath = path.join(
    process.cwd(),
    'external/SnakeBench/backend/model_lists/model_list.yaml'
  );

  if (!fs.existsSync(modelListPath)) {
    console.error('model_list.yaml not found at:', modelListPath);
    process.exit(1);
  }

  const content = fs.readFileSync(modelListPath, 'utf-8');
  const modelList = yaml.load(content) as Record<string, any>;

  console.log(`Found ${Object.keys(modelList).length} models in model_list.yaml`);

  for (const [slug, modelData] of Object.entries(modelList)) {
    const { provider, name } = modelData;

    // Upsert: insert if not exists, update if exists
    await db
      .insert(snakeBenchModels)
      .values({
        modelSlug: slug,
        provider,
        name,
        isActive: true, // Mark as active for now
        testStatus: 'untested',
      })
      .onConflictDoUpdate({
        target: snakeBenchModels.modelSlug,
        set: {
          name,
          provider,
          updatedAt: new Date(),
        },
      });
  }

  console.log('✓ Models initialized');
}

main().catch(console.error);
```

**Add to `package.json`:**
```json
{
  "scripts": {
    "snakebench:init": "tsx server/scripts/initSnakeBenchModels.ts"
  }
}
```

**Usage:**
```bash
npm run snakebench:init
```

### 3.3 – Service Layer: Persist Matches on Completion

**File to modify:** `server/services/snakeBenchService.ts`

After Python execution succeeds in `runMatch()`:

```typescript
async runMatch(request: SnakeBenchRunMatchRequest) {
  // ... existing logic: spawn Python, validate, parse JSON ...
  // const result = { gameId, scores, results, ... };

  // NEW: Persist to database
  try {
    const modelA = await this.getOrCreateModel(request.modelA);
    const modelB = await this.getOrCreateModel(request.modelB);

    // Insert game row
    await db.insert(snakeBenchGames).values({
      id: result.gameId,
      status: 'completed',
      startTime: new Date(),
      endTime: new Date(),
      rounds: result.rounds ?? 0,
      boardWidth: request.width ?? 19,
      boardHeight: request.height ?? 19,
      numApples: request.numApples ?? 1,
      totalScore: result.totalScore ?? 0,
      gameType: 'ladder',
    });

    // Insert participants
    const slotA = 0;
    const slotB = 1;
    await db.insert(snakeBenchGameParticipants).values({
      gameId: result.gameId,
      modelId: modelA.id,
      playerSlot: slotA,
      score: result.scores[request.modelA] ?? 0,
      result: result.results[request.modelA] ?? 'tied',
    });
    await db.insert(snakeBenchGameParticipants).values({
      gameId: result.gameId,
      modelId: modelB.id,
      playerSlot: slotB,
      score: result.scores[request.modelB] ?? 0,
      result: result.results[request.modelB] ?? 'tied',
    });

    // Update model stats (if lightweight tracking)
    // For now, we leave advanced Elo to Greg's project
  } catch (err) {
    // Log but don't fail the API response; DB errors shouldn't block match execution
    logger.error('Failed to persist SnakeBench match:', err);
  }

  return { success: true, result, timestamp: Date.now() };
}

private async getOrCreateModel(slug: string) {
  let model = await db.query.snakeBenchModels
    .findFirst({ where: eq(snakeBenchModels.modelSlug, slug) });

  if (!model) {
    // Create placeholder if not found
    await db.insert(snakeBenchModels).values({
      modelSlug: slug,
      provider: 'unknown',
      name: slug,
      isActive: true,
    });
    model = await db.query.snakeBenchModels
      .findFirst({ where: eq(snakeBenchModels.modelSlug, slug) });
  }

  return model;
}
```

### 3.4 – Optional: Update `/api/snakebench/games` to Query DB First

**File to modify:** `server/services/snakeBenchService.ts` → `listGames()`

```typescript
async listGames(limit: number = 50) {
  try {
    // Query our local DB first (faster, more queryable)
    const games = await db
      .select()
      .from(snakeBenchGames)
      .orderBy(desc(snakeBenchGames.createdAt))
      .limit(limit);

    return games.map(game => ({
      gameId: game.id,
      startedAt: game.startTime?.toISOString(),
      totalScore: game.totalScore,
      roundsPlayed: game.rounds,
      path: game.replayPath,
    }));
  } catch (err) {
    logger.warn('DB query failed; falling back to JSON files', err);
    // Fall back to JSON scanning (existing logic)
    return this.listGamesFromJSON(limit);
  }
}
```

---

## Phase 4: Optional Lightweight Summaries (Future)

### Goal
Add **read-only summary endpoints** if/when needed. Keep them simple; treat Greg's SnakeBench project as **the canonical analytics source**.

### Potential Optional Endpoints

- `GET /api/snakebench/recent-activity` – Last N games from our DB (simple query, no aggregation).
- `GET /api/snakebench/model/:slug/history` – Games involving a specific model.
- **Do NOT build:**
  - Full Elo leaderboards (use Greg's).
  - Complex win-rate analytics (use Greg's).
  - Cross-experiment stats (use Greg's).

If we need these later, we import/merge from Greg's dataset instead of recomputing locally.

---

## Compatibility with Root SnakeBench DB

### Why This Matters

Greg's SnakeBench project is the **canonical source** for leaderboards, Elo ratings, and analytics. By keeping our schema and semantics aligned:

- We can **export our local data** to Greg's format without translation.
- We can **import Greg's data** for comparison/backfill.
- Future dataset merges are "apples to apples."

### Schema Contract

Our tables are **exact 1:1 mappings** of `docs/SNAKE_BENCH_DB.md`:
- Column names, types, and constraints match.
- Enum-like fields (`test_status`, `game_type`, `result`) use the same values.
- Identifiers (`model_slug`, `game_id`, `player_slot`) align with SnakeBench conventions.

### What We Do NOT Own

- **Elo ratings:** We store the column but leave it at default or import from Greg.
- **Advanced analytics:** Win rates, cross-model stats, Elo trends → query Greg's project.
- **Full leaderboards:** Display Greg's leaderboard; use our local DB for personal game history only.

### Metadata Flexibility

If we need ARC-Explainer-specific data, we:
1. Use existing JSONB fields (`metadata_json`, `current_state`).
2. Document the schema in our code.
3. Never add ARC-only columns that would complicate merges.

---

## Implementation Checklist

### Phase 1: MVP Hardening
- [ ] Add SnakeBench setup docs to `DEVELOPER_GUIDE.md` or `docs/SNAKEBENCH_SETUP.md`.
- [ ] Create helper scripts: `scripts/setup-snakebench.sh` and `.bat`.
- [ ] Test local dev setup on Windows, macOS, Linux.
- [ ] Verify Railway build logs include SnakeBench preparation messages.

### Phase 2: BYO Keys & Config
- [ ] Extend `SnakeBenchRunMatchRequest` and `SnakeBenchRunBatchRequest` in `shared/types.ts`.
- [ ] Update `snakeBenchService.ts` to map BYO key + provider to env vars (Poetiq pattern).
- [ ] Update `snakeBenchController.ts` to accept and pass through keys without logging them.
- [ ] Update `SnakeArena.tsx` to use `VITE_SNAKEBENCH_URL` (fallback to default).
- [ ] Optional: Add BYO key UI toggle in `SnakeArena.tsx`.
- [ ] Document `VITE_SNAKEBENCH_URL` in Railway environment configuration notes.
- [ ] Test BYO key flow end-to-end locally and in staging.

### Phase 3: Database Persistence
- [ ] Add `models`, `games`, `game_participants` tables to `server/db/schema.ts` (exact 1:1 mapping of `SNAKE_BENCH_DB.md`).
- [ ] Run `npm run db:push` to apply schema.
- [ ] Create `server/scripts/initSnakeBenchModels.ts` to populate models from `model_list.yaml`.
- [ ] Run `npm run snakebench:init` to initialize models.
- [ ] Update `snakeBenchService.runMatch()` to persist games and participants after completion.
- [ ] Update `snakeBenchService.listGames()` to query DB first, fallback to JSON.
- [ ] Test: Run match, verify `games` and `game_participants` rows appear in Supabase.
- [ ] Test: List games endpoint returns DB results.

### Phase 4: Optional Lightweight Summaries (Defer)
- [ ] Design `/api/snakebench/recent-activity` endpoint (if needed).
- [ ] Design `/api/snakebench/model/:slug/history` endpoint (if needed).
- [ ] **Explicitly document:** These are summaries only; Greg's SnakeBench is the analytics source.

---

## Implementation Order

**Recommended sequence (can run in parallel within phases):**

1. **Phase 1 first** – Make local dev & Railway rock-solid.
2. **Phase 2 in parallel** – BYO keys and config; both are orthogonal to Phase 1.
3. **Phase 3 after 1 & 2** – Database tables; non-blocking if they fail (JSON backup exists).
4. **Phase 4 much later** – Only if lightweight summaries are actually needed.

---

## Key Decisions

### 1. Compatibility-First Over Feature-Rich
- We implement the exact schema Greg uses, not an "optimized" variant.
- Elo and advanced stats are optional/imported, not computed here.

### 2. Persistence Is Non-Blocking
- If database write fails, the match API still succeeds.
- JSON file storage is the reliable fallback.

### 3. No Parallel Analytics Stack
- We don't build leaderboards, Elo engines, or analytics dashboards in this repo.
- We delegate to Greg's SnakeBench project; our role is **compatible local storage**.

### 4. BYO Keys Reuse Poetiq Pattern
- Same env var mapping, same security (no logging keys).
- Aligns with existing ARC Explainer patterns.

### 5. Simple Model Initialization
- Read from `model_list.yaml` once, store in our DB.
- Keeps model lists in sync without manual entry.

---

## Effort Estimate

| Phase | Effort | Notes |
|-------|--------|-------|
| Phase 1 | 3–4h | Docs, scripts, verification |
| Phase 2 | 4–5h | Type updates, BYO logic, frontend UI |
| Phase 3 | 5–6h | Schema, service updates, testing |
| Phase 4 | 2–3h | Optional summaries (if needed) |
| **Total** | **14–18h** | **Can ship Phase 1–3 in ~2 weeks** |

---

## Why This Approach Works

✅ **Pragmatic:** Stabilizes MVP first, adds persistence as a bonus.
✅ **Compatible:** Our schema lines up with Greg's; merges are straightforward.
✅ **Low-risk:** Database failures don't break matches (JSON backup).
✅ **Follows patterns:** Reuses Saturn/Poetiq/Beetree precedents.
✅ **Lean:** No big analytics engine; delegates heavy lifting to Greg's project.
✅ **Future-proof:** When we want analytics, we merge or import from canonical source.

---

## Next Steps

1. **Approve this plan.**
2. **Start Phase 1:** Document setup, create helper scripts.
3. **Validate** on Windows, macOS, Linux locally.
4. **Move to Phase 2:** BYO keys + `VITE_SNAKEBENCH_URL`.
5. **Then Phase 3:** Database tables and light persistence.
6. **Defer Phase 4** unless summaries are actually needed.

---

**Ready to implement. What questions do you have?**
