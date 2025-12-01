# beetreeARC Solver Integration Plan

Author: Claude Code using Sonnet 4.5
Date: 2025-12-01
PURPOSE: Technical integration plan for beetreeARC LLM-based solver into arc-explainer
SRP/DRY check: Pass - Reuses existing Python bridge, SSE streaming, database patterns, and UI components

## Objective

Integrate beetreeARC—a multi-stage, ensemble LLM solver—into arc-explainer for single-puzzle execution, preserving the current Saturn/Grover solver patterns and reusing UI components, Python bridge infrastructure, and database models.

## Files to Modify

- `server/services/pythonBridge.ts` - Add beetreeARC execution method
- `server/services/beetreeService.ts` - NEW: Service layer for beetree orchestration
- `server/services/streaming/beetreeStreamService.ts` - NEW: SSE streaming for beetree progress
- `server/services/aiServiceFactory.ts` - Register beetree service
- `server/config/models.ts` - Add beetree meta-models (ensemble configurations)
- `shared/types.ts` - Add beetree-specific types and response structures
- `shared/schema.ts` - Extend explanations table for beetree metadata
- `server/repositories/ExplanationRepository.ts` - Add beetree result persistence methods
- `server/routes/beetree.ts` - NEW: Beetree-specific API endpoints
- `server/index.ts` - Mount beetree routes

## Files to Create

- `server/python/beetree_wrapper.py` - Python bridge wrapper (similar to saturn_wrapper.py)
- `client/src/pages/BeetreeSolver.tsx` - UI page for beetree solver (reuse Saturn patterns)
- `client/src/components/beetree/BeetreeProgressDashboard.tsx` - Multi-stage progress visualization
- `client/src/components/beetree/BeetreeResultsPanel.tsx` - Consensus results display with cost breakdown
- `client/src/components/beetree/BeetreeCostDisplay.tsx` - Post-run cost breakdown display
- `client/src/components/beetree/BeetreeCostEstimator.tsx` - Pre-run cost estimation
- `client/src/hooks/useBeetreeRun.ts` - React hook for beetree execution
- `server/services/beetree/` - Directory for beetree-specific utilities:
  - `consensusAnalyzer.ts` - Analyze multi-model agreement
  - `stageOrchestrator.ts` - Control 5-stage execution flow
  - `costTracker.ts` - Track and calculate API costs per run

## Implementation Tasks

### Backend: Python Bridge & Core Infrastructure

1. Create `server/python/beetree_wrapper.py` wrapping beetreeARC's `run_solver_mode()` in single-task mode (--task <task_id>) with NDJSON event protocol matching Saturn's interface (start/progress/log/final events), including token count and cost data in events

2. Extend `server/services/pythonBridge.ts` with `runBeetreeAnalysis()` method that spawns beetree_wrapper.py, passes task_id/test_index/mode/progress_queue, and streams NDJSON events with cost tracking

3. Create `server/services/beetreeService.ts` extending `BaseAIService` with `analyzePuzzleWithModel()` method orchestrating: payload construction, pythonBridge.runBeetreeAnalysis(), result validation, cost calculation, and database persistence

4. Create `server/services/beetree/costTracker.ts` with methods: `trackModelCall()`, `calculateRunCost()`, `getCostBreakdown()` using beetreeARC pricing constants (GPT-5.1 $1.25/$10, Claude Opus $5/$25, Gemini $2/$12 per 1M tokens)

5. Create `server/services/beetree/consensusAnalyzer.ts` with `findConsensusGrid()` and `calculateAgreementScore()` functions for multi-model result aggregation

6. Create `server/services/beetree/stageOrchestrator.ts` controlling early termination logic (if consensus reached at stage 1/3, skip remaining stages to save cost)

### Backend: Types and Database Schema

7. Add beetree-specific types to `shared/types.ts`: `BeetreeStage`, `BeetreeConsensusResult`, `BeetreeModelResult`, `BeetreeRunConfig`, `BeetreeProgressEvent`, `BeetreeCostBreakdown`, `BeetreeTokenUsage`

8. Extend `shared/schema.ts` explanations table with columns: `beetree_stage TEXT`, `beetree_consensus_count INTEGER`, `beetree_model_results JSONB`, `beetree_cost_breakdown JSONB` (stores per-model costs, token counts, total cost), `beetree_token_usage JSONB` (input/output tokens per model)

9. Add methods to `server/repositories/ExplanationRepository.ts`: `saveBeetreeRun()` (includes cost data), `getBeetreeRunsByTask()`, `getBeetreeConsensusStats()`, `updateBeetreeStageProgress()`, `getBeetreeCostHistory()`

### Backend: Streaming & API Layer

10. Create `server/services/streaming/beetreeStreamService.ts` implementing SSE stream manager for beetree's 5-stage progress (shallow/baseline/extended/deep/full search), emitting cost-in-progress events

11. Modify `server/services/streaming/SSEStreamManager.ts` to register beetree stream handler alongside existing Saturn/Grover handlers

12. Add WebSocket fallback support in `server/services/wsService.ts` for beetree progress broadcasts including cost updates

13. Create `server/routes/beetree.ts` with endpoints:
    - `POST /api/beetree/run` - Start single-puzzle solver run (mode: testing/production, task_id: string)
    - `GET /api/beetree/status/:runId` - Get current status with cost-so-far for a single run
    - `POST /api/beetree/estimate-cost` - Estimate cost before running a single puzzle (based on mode and puzzle complexity)
    - `GET /api/beetree/history/:taskId` - Get past individual runs for this specific task with cost data
    - `GET /api/beetree/cost-breakdown/:runId` - Get detailed cost breakdown by model/stage for a single run

14. Mount beetree routes in `server/index.ts` after existing solver routes (arc3, saturn, grover)

15. Register beetreeService in `server/services/aiServiceFactory.ts` with model keys: `beetree-testing`, `beetree-production`, `beetree-ensemble-gpt5`, `beetree-ensemble-claude`, `beetree-ensemble-gemini`, `beetree-full`

### Backend: Configuration

16. Add beetree model configs to `server/config/models.ts`:
    - `beetree-testing` mode: 3 cheap models, 5min, ~$0.50-$2 per run
    - `beetree-production` mode: 8 frontier models, 45min, ~$15-$50 per run
    - Custom ensemble modes with cost estimates

17. Update `.env.example` with required API keys: `ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY` (beetree requires OpenAI + Anthropic + Google Gemini)

18. Modify `server/services/pythonBridge.ts` to pass API keys to beetree_wrapper.py via environment variables

### Frontend: UI Components

19. Create `client/src/pages/BeetreeSolver.tsx` reusing PuzzleExaminer header, PuzzleGridDisplay, and ModelSelection patterns with beetree-specific controls (mode selector: testing/production, stage checkpoints)

20. Create `client/src/components/beetree/BeetreeProgressDashboard.tsx` showing Rich CLI-style table: task_id, status, current_stage, outcome, duration, cost_so_far with live SSE updates

21. Create `client/src/components/beetree/BeetreeResultsPanel.tsx` displaying: consensus grid, agreement percentage, per-model results, reasoning summaries, **cost breakdown section** (total cost, per-model costs, token counts)

22. Create `client/src/components/beetree/BeetreeCostDisplay.tsx` component showing:
    - Total run cost
    - Cost breakdown by model (e.g., "GPT-5.1: $12.34, Claude Opus: $8.56")
    - Cost breakdown by stage (e.g., "Stage 1: $5.00, Stage 2: $15.00")
    - Token usage (input tokens, output tokens, reasoning tokens per model)
    - Cost comparison vs. estimate

23. Create `client/src/components/beetree/BeetreeCostEstimator.tsx` showing pre-run cost estimate based on selected mode:
    - Testing mode: "$0.50-$2.00 estimated (3 models, 2-6 minutes)"
    - Production mode: "$15-$50 estimated (8 models, 20-45 minutes)"
    - Explanation of what affects cost (number of models, search depth, token usage)

24. Create `client/src/hooks/useBeetreeRun.ts` React hook managing: SSE connection, progress state (including cost updates), result fetching, error handling, cancellation

25. Add beetree route to `client/src/App.tsx` router config: `/beetree/:taskId?` with lazy loading

26. Update `client/src/pages/PuzzleBrowser.tsx` to add "Solve with Beetree" button alongside existing Saturn/Grover solver links

#### Reviewer Notes (UI coverage gaps to address before build)

- Surface the new history/cost endpoints (`GET /api/beetree/history/:taskId`, `GET /api/beetree/cost-breakdown/:runId`) in the UI—add a "Past Runs for This Task" drawer or history tab on `BeetreeSolver` so users can view previous individual attempts on the current puzzle with cost data and consensus grids.
- Production runs cost $15-$50 and take up to 45 minutes for a single puzzle, so add an explicit confirmation modal (and ideally a cancel/stop action) before starting production mode; the plan mentions the estimator component but no guardrails to prevent accidental big charges.
- Keep the Beetree components on the existing shadcn/ui design system instead of inventing "Rich CLI-style tables"; note in each component spec that they must reuse the shared Cards/Tables/Badges so styling stays consistent with Saturn/Grover pages.
- Beyond the Puzzle Browser CTA, add a navigation entry (e.g., top-level solver switcher or header link) so Beetree is discoverable from other parts of the app; `/beetree` exists, but no nav route exposes it yet.

### Testing & Validation

27. Create `server/services/beetree/__tests__/beetreeService.test.ts` with unit tests for: mode selection, consensus logic, cost calculation accuracy, stage progression, cost tracking

28. Create `server/python/__tests__/beetree_wrapper.test.py` to validate NDJSON event emission, task loading, error handling, cost data emission

29. Add integration test in `server/routes/__tests__/beetree.test.ts` testing full flow: POST /api/beetree/run → SSE progress with cost updates → result persistence → GET /api/beetree/history with cost data

30. Create smoke test script `scripts/test-beetree.sh` that runs beetree-testing mode on task 2ba387bc (from beetreeARC examples) and validates cost tracking for the single-puzzle run

31. Create `server/services/beetree/__tests__/costTracker.test.ts` to validate cost calculation accuracy against known token counts and pricing

## Integration Points

### Reusing Existing Patterns

- **Python Bridge**: Beetree wrapper uses same NDJSON protocol as Saturn (start/progress/log/final events)
- **Streaming**: Reuse SSEStreamManager and wsService broadcast infrastructure
- **Database**: Extend existing explanations table (no new tables needed)
- **UI Components**: Reuse PuzzleGridDisplay, shadcn/ui Card/Badge/Alert, AnalysisResults panels
- **Provider Logic**: Leverage existing OpenAI Responses API integration patterns from `server/services/openai/`

### New Capabilities

- **Multi-Model Ensemble**: First solver orchestrating 3 providers (OpenAI, Anthropic, Google) for single-puzzle execution
- **Progressive Search**: 5 checkpointed stages with early termination on consensus (cost optimization per puzzle)
- **Consensus Selection**: Aggregate multiple model calls for one puzzle, pick solution with highest agreement
- **Cost Transparency**: Real-time cost tracking during single-puzzle runs, post-run detailed breakdown display, pre-run cost estimation
- **Token Usage Tracking**: Track input/output/reasoning tokens per model for each puzzle run, display in UI
- **Verification**: Built-in hint generation and solution verification logic from beetreeARC for individual tasks

### Integration with Existing Features

- **Model Debate**: Individual beetree results can feed into PuzzleDiscussion as high-quality consensus solutions
- **Analytics**: Track beetree accuracy per puzzle, cost per puzzle run, stage completion rates, cost trends in MetricsRepository
- **ELO Leaderboard**: Add "Beetree Ensemble" as virtual model entry (aggregate ELO from single-puzzle consensus results)
- **Conversation Chaining**: Store OpenAI `response.id` from beetree GPT-5.1 single-task calls for follow-up debugging

## Cost Tracking Architecture

### Cost Data Flow (Single Puzzle Run)

1. **Python Wrapper**: beetree_wrapper.py tracks each API call's token usage and calculates cost using provider pricing for the single task
2. **NDJSON Events**: Progress events include `cost_so_far`, `tokens_used`, `current_stage_cost` fields for the current puzzle run
3. **Backend Service**: beetreeService accumulates costs in real-time for this puzzle, stores final breakdown in database
4. **SSE Stream**: Broadcasts cost updates to frontend during the single-puzzle run
5. **Database**: Stores complete cost breakdown for this puzzle run in `beetree_cost_breakdown` JSONB column
6. **Frontend**: Displays live cost updates during the puzzle run, detailed breakdown after completion

### Cost Breakdown Structure

```typescript
interface BeetreeCostBreakdown {
  total_cost: number;           // Total cost in USD
  by_model: {
    model_name: string;
    input_tokens: number;
    output_tokens: number;
    reasoning_tokens: number;   // For o1/o3-style models
    cost: number;
  }[];
  by_stage: {
    stage: BeetreeStage;        // shallow/baseline/extended/deep/full
    cost: number;
    duration_seconds: number;
  }[];
  estimated_cost: number;       // Pre-run estimate
  cost_variance: number;        // Actual vs. estimate
}
```

### Cost Estimation Logic

Pre-run estimation in `costTracker.ts`:
- Testing mode: 3 models × avg 2.5 calls × avg 4000 tokens × avg $0.15/1M = $0.60-$0.90
- Production mode: 8 models × avg 22 calls × avg 5000 tokens × avg $2.50/1M = $20-$44
- Factors: puzzle complexity (grid size), search depth (mode), provider pricing

Post-run actual cost calculated from real token counts and current pricing tables.

## Configuration Modes (Single Puzzle Execution)

### Testing Mode (Fast Validation)

Run `POST /api/beetree/run` with `mode: "testing"` and `task_id`:
- Models: claude-sonnet-4.5-no-thinking, gpt-5.1-none, gemini-3-low
- Expected Duration: 2-6 minutes per puzzle
- Expected Cost: $0.50-$2.00 per puzzle
- Expected Accuracy: ~20-30% (low-effort models)
- Use Case: Development, CI/CD, quick validation of individual puzzles, cost testing

### Production Mode (Full Solver)

Run `POST /api/beetree/run` with `mode: "production"` and `task_id`:
- Models: 8 frontier models (2x GPT-5.1-high, 2x Claude Opus thinking-60000, 2x Claude Sonnet thinking-60000, 2x Gemini-3-high)
- Expected Duration: 20-45 minutes per puzzle
- Expected Cost: $15-$50 per puzzle
- Expected Accuracy: 50%+ (matches beetreeARC leaderboard performance)
- Use Case: Serious single-puzzle ARC-AGI solving attempts, competition submissions

### Rate Limiting Strategy

Leverage beetreeARC's built-in rate limiting for single-puzzle runs:
- OpenAI: 500 req/min (sufficient for single tasks)
- Anthropic: Prompt caching reduces costs 90% per puzzle (enable in wrapper)
- Google Gemini: 15 req/min (sufficient for individual puzzle execution)

No user-level quotas implemented - cost tracking is informational only for individual runs.

## Validation Testing

### Testing Mode Validation

1. Run beetree on task `2ba387bc` with mode "testing"
2. Verify:
   - Duration: 2-6 minutes
   - Cost displayed: $0.50-$2.00
   - Cost breakdown shows 3 models
   - Token counts present for each model
   - SSE events include cost updates

### Production Mode Validation

1. Run beetree on task `2ba387bc` with mode "production"
2. Verify:
   - Duration: 20-45 minutes
   - Cost displayed: $15-$50
   - Cost breakdown shows 8 models
   - Stage-by-stage cost progression
   - Early termination saves cost if consensus reached

### Cost Calculation Validation

1. Run test with known token counts
2. Verify calculated cost matches expected (model pricing × token count / 1M)
3. Test across all 3 providers (OpenAI, Anthropic, Google)
4. Verify reasoning token pricing for o1/o3 models

## Migration & Backward Compatibility

### No Breaking Changes

- Existing Saturn/Grover solvers remain functional
- Beetree is additive (new routes, new service, new UI page)
- Database schema extensions are nullable (no data migration required)

### Feature Flag (Optional)

Add to `shared/utils/featureFlags.ts`:
```typescript
export const FEATURE_BEETREE_SOLVER = process.env.ENABLE_BEETREE === 'true';
```

Conditionally render "Solve with Beetree" button and `/beetree` route based on flag.

### Deprecation Path

No deprecations planned. Beetree complements existing solvers for single-puzzle execution:
- **Saturn**: Single-model visual reasoning (fast, low-cost per puzzle)
- **Grover**: Iterative code generation (DSL-based, deterministic per puzzle)
- **Beetree**: Multi-model ensemble (slow, higher-cost per puzzle, highest accuracy, full cost transparency)

Users choose solver based on use case and cost tolerance for individual puzzle attempts.

## Documentation Requirements

Create these docs:
- `docs/BEETREE_GUIDE.md` - User guide (how to run single puzzles, interpret results, understand cost breakdown per puzzle)
- `docs/reference/api/BEETREE_API.md` - API endpoint reference for single-puzzle execution including cost endpoints
- `docs/architecture/BEETREE_ARCHITECTURE.md` - Technical deep-dive (how consensus works per puzzle, stage progression, provider routing, cost tracking implementation)

Update existing docs:
- `README.md` - Add beetree to solver comparison table with cost information, clarify single-puzzle execution mode
- `CLAUDE.md` - Add beetree-specific development notes emphasizing single-task mode
- `CHANGELOG.md` - Document beetree integration in appropriate version

## Post-Implementation Enhancements

### Performance Optimization

1. **Caching**: Store hint generations in Redis (reuse across similar puzzles during single runs, reduce cost)
2. **Parallelization**: Increase ThreadPoolExecutor workers from 10 to 20 (faster stage completion per puzzle)
3. **Model Selection**: Add A/B testing for model combinations on individual puzzles (find optimal cost/accuracy tradeoff)

### Feature Enhancements

1. **Custom Ensembles**: Let users select specific models for single-puzzle runs (e.g., "GPT-5.1 only" for cost control)
2. **Solution Library**: Store verified beetree solutions as "golden answers" for future reference
3. **Cost Alerts**: Optional notification when a single puzzle run exceeds estimated cost by threshold
4. **Run Cancellation**: Allow users to stop a long-running puzzle execution mid-stage

### Analytics Integration

1. Track beetree cost trends over time (avg cost per puzzle, total monthly spend across all individual runs)
2. Identify puzzle types where beetree excels (use for cost-effective targeted single-puzzle solving)
3. Compare beetree cost vs. Saturn/Grover cost for similar accuracy on individual puzzles
4. Cost/accuracy ratio analysis per puzzle (which configurations give best value)

## Summary

This plan integrates beetreeARC as a first-class single-puzzle solver in arc-explainer with:
- **31 implementation tasks** organized by area (Backend, Frontend, Testing)
- **~20 files to modify**, **~15 files to create**
- **Zero breaking changes** to existing features
- **Single-puzzle execution only**: Users run beetree on one task at a time via `POST /api/beetree/run` with `task_id`
- **Comprehensive cost tracking**: pre-run estimation, live updates during run, post-run breakdown, token usage display per puzzle
- **Cost transparency**: Users see exactly what each individual puzzle run costs, broken down by model and stage
- **No batch processing**: The Python wrapper calls beetreeARC in single-task mode only (--task <task_id>)

The integration leverages existing Python bridge patterns, UI components, and database schema while adding new capabilities: multi-model ensembles for individual puzzles, progressive search with early termination, consensus-based solution selection per puzzle, and complete cost/token visibility for each run. All code follows CLAUDE.md principles: SRP, DRY, production-ready, no mocks.
