/**
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-25T17:30:00-05:00
 * PURPOSE: Plan to overcome Gemini API rate limits for Poetiq solver
 *          and create a usable UI for running the 94 remaining ARC2-eval puzzles.
 * SRP and DRY check: Pass - Standalone planning document.
 */

# Poetiq Solver - Rate Limit Mitigation Plan

## Problem Statement

1. **Gemini API rate limits exhausted** - Direct API calls to Gemini 3 Pro Preview are hitting quota limits
2. **No UI exists** - The Poetiq solver has no user interface, only API endpoints
3. **94 puzzles remain untested** - Need a strategy to run all of them without hitting rate limits
4. **TypeScript IDE errors** - False positives in routes.ts and poetiqController.ts (runtime works fine)

---

## Solution Architecture

### 1. OpenRouter Integration for Poetiq

**Key Insight**: The Poetiq solver uses `litellm` which natively supports OpenRouter!

LiteLLM model format for OpenRouter:
```python
# Instead of:
"gemini/gemini-3-pro-preview"

# Use:
"openrouter/google/gemini-2.0-flash-001"  # or another model
```

**Implementation Steps**:

1. **Modify `poetiq-solver/arc_agi/config.py`**:
   - Add OpenRouter model IDs to the CONFIG_LIST
   - Example: `"openrouter/google/gemini-2.0-flash-001"`
   
2. **Modify `poetiq-solver/arc_agi/llm.py`**:
   - Add rate limiters for OpenRouter models
   - Add props configuration for OpenRouter models

3. **Environment variable**:
   - LiteLLM uses `OPENROUTER_API_KEY` automatically
   - Already set in the project's `.env` file

---

### 2. Batch Strategy - Chunked Processing

Instead of running all 94 puzzles at once, break into manageable batches:

| Batch Size | Number of Batches | Estimated Time per Batch |
|------------|-------------------|--------------------------|
| 10 puzzles | 10 batches        | ~30-50 minutes           |
| 5 puzzles  | 19 batches        | ~15-25 minutes           |

**Rate Limit Mitigation**:
- Add configurable delay between puzzles (e.g., 30-60 seconds)
- Add configurable delay between batches (e.g., 5 minutes)
- Track which puzzles completed successfully for resume capability

---

### 3. UI Page Requirements

Create `client/src/pages/PoetiqSolver.tsx` following the `GroverSolver.tsx` pattern:

**Features**:
- Puzzle selector (dropdown or search)
- Model selector (Gemini direct vs OpenRouter)
- Batch size selector (1, 5, 10, or custom list)
- Start/Stop controls
- Real-time progress via WebSocket
- Results display (PASS/FAIL/ERROR)
- Generated code viewer

**Components to create**:
- `client/src/components/poetiq/PoetiqModelSelect.tsx`
- `client/src/components/poetiq/PoetiqProgressCard.tsx`
- `client/src/components/poetiq/PoetiqBatchStatus.tsx`
- `client/src/hooks/usePoetiqProgress.ts`

---

### 4. TypeScript IDE Errors

The errors in `routes.ts` and `poetiqController.ts` are **IDE false positives**:
- Same "errors" appear throughout the entire existing codebase
- The server compiles and runs correctly
- Root cause: TypeScript language server not resolving Express types properly

**Non-blocking** - The code works at runtime.

---

## Implementation TODO List

### Phase 1: OpenRouter Support in Poetiq (Backend)

- [ ] Add OpenRouter model IDs to `poetiq-solver/arc_agi/types.py`
- [ ] Add rate limiters for OpenRouter in `poetiq-solver/arc_agi/llm.py`
- [ ] Add OpenRouter config entry in `poetiq-solver/arc_agi/config.py`
- [ ] Update `poetiqController.ts` to accept provider parameter (gemini-direct vs openrouter)
- [ ] Test OpenRouter integration with single puzzle

### Phase 2: Batch Improvements (Backend)

- [ ] Add configurable delay between puzzles in batch endpoint
- [ ] Add resume capability (skip already-solved puzzles)
- [ ] Add batch size limit parameter
- [ ] Add pause/resume functionality for batches

### Phase 3: UI Page (Frontend)

- [ ] Create `usePoetiqProgress.ts` hook (similar to `useGroverProgress.ts`)
- [ ] Create `PoetiqModelSelect.tsx` component
- [ ] Create `PoetiqSolver.tsx` page
- [ ] Add route to App.tsx
- [ ] Add navigation link to sidebar/menu

### Phase 4: Testing

- [ ] Test single puzzle via UI with OpenRouter
- [ ] Test small batch (5 puzzles) via UI
- [ ] Verify database saves correctly
- [ ] Verify no rate limit errors with OpenRouter

---

## OpenRouter Model Options

Available models via OpenRouter that could work:

| Model ID (OpenRouter) | Notes |
|-----------------------|-------|
| `openrouter/google/gemini-2.0-flash-001` | Fast, cheaper |
| `openrouter/google/gemini-2.5-pro-preview-05-06` | Closest to Gemini 3 Pro |
| `openrouter/anthropic/claude-sonnet-4` | Alternative provider |
| `openrouter/openai/gpt-4o` | Alternative provider |

Check current aliases in the project's model management system for exact IDs.

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| OpenRouter rate limits | Medium | Add delays, use multiple models |
| Different results with OpenRouter | Low | Same models, same prompts |
| UI complexity | Low | Follow GroverSolver pattern |
| Database schema issues | Low | Already tested with single puzzle |

---

## Success Criteria

1. Can run Poetiq solver on a single puzzle via UI
2. Can run batch of 5-10 puzzles without rate limit errors
3. Results saved correctly to database
4. Can pause/resume batch runs
5. All 94 remaining puzzles eventually completed

---

*Plan created 2025-11-25. Update as implementation progresses.*
