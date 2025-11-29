## ARC Explainer
- Use proper semantic versioning (MAJOR.MINOR.PATCH) for all changes!! Add new changes at the top!!!

### Version 5.32.7

- **Model Catalog: Full GPT-5.1 Codex + Poetiq Integration** (Author: Cascade using Cascade)
  - **Change**: Added the full `GPT-5.1 Codex` reasoning model alongside `GPT-5.1 Codex Mini` in the shared `MODELS` config, with pricing set to `$1.25` input / `$10.00` output per 1M tokens and identical context/metadata to the mini variant.
  - **Change**: Exposed `gpt-5.1-codex` as a direct OpenAI option in `/api/poetiq/models`, so Poetiq Community/Solver can select it just like Codex Mini while still treating BYO keys as optional.
  - **Change**: Updated Poetiq cost tracking to recognize both `gpt-5.1-codex` and `gpt-5.1-codex-mini` with their correct per-token prices, and taught the Poetiq service to route BYO keys for `gpt-5.1-codex` through `OPENAI_API_KEY` (direct Responses API) instead of OpenRouter.

### Version 5.32.6

- **Gemini thinking_config hotfix** (Author: Codex / GPT-5)
  - **Problem**: Direct Gemini calls (including Poetiq runs) failed with `Unknown field for GenerationConfig: thinking_config` when hitting `gemini-3-pro-preview`, causing immediate retries and no model output.
  - **Fix**: Removed the unsupported `thinking_config` payload from the shared Gemini service generation config (`server/services/gemini.ts`) and the Poetiq solver’s Gemini client (`solver/poetiq/llm.py`), leaving only fields accepted by the current Google Generative AI SDK. Added a note to re-enable thinking controls after migrating to a SDK version that supports them.
  - **Docs**: Captured the mitigation steps and scope in `docs/2025-11-29-gemini-thinking-config-hotfix-plan.md`.

### Version 5.32.5

- **Poetiq Solver: GPT-5.1 Codex Mini Verbosity Fix + BYO Routing Alignment** (Author: Cascade using Cascade)
  - **Problem**: Direct OpenAI runs with `gpt-5.1-codex-mini` were failing with `400 invalid_request_error` because `text.verbosity: 'high'` is not supported for that model (only `'medium'` is allowed). The solver page BYO key gating also used string heuristics that could drift from backend metadata.
  - **Fix**: Updated `solver/poetiq/llm.py` to clamp `text.verbosity` to `'medium'` specifically for `gpt-5.1-codex-mini` while keeping `'high'` as the default for other GPT-5.x/o3 models. Updated `PoetiqSolver` to consume dynamic `requiresBYO` / `routing` metadata from `/api/poetiq/models` so BYO key requirements and Community auto-start behavior stay consistent with the backend.
  - **Result**: OpenAI Responses API calls for `gpt-5.1-codex-mini` no longer 400 on verbosity, and the solver page now matches the Community page in which models truly require BYO keys vs can safely use the server OpenAI key.

### Version 5.32.4

- **Poetiq Community: Dynamic Model Metadata & API Key UI Fixes** (Author: Cascade using Cascade; code authored by Codex / GPT-5)
  - **Fix**: Community page now uses the shared `usePoetiqModels()` hook instead of a hardcoded model list, so provider, routing, and `requiresBYO` flags always stay in sync with `server/config/models.ts` and `/api/poetiq/models`.
  - **Fix**: Resolved undefined property errors in the API key help section by switching to derived `keyPlaceholder`/`providerKeyUrl` variables, adding optional chaining for `selectedModel?.provider`, and ensuring external links include `rel="noreferrer"`.
  - **Result**: Poetiq Community always shows accurate BYO key requirements and recommended models without runtime errors, fully aligning the page with the 5.32.3 BYO relaxation behavior.

### Version 5.32.3

- **Poetiq Solver: BYO Key Relaxation + GPT-5.1 Codex Mini Default** (Author: Cascade using Cascade)
  - **Change**: Adjusted Poetiq BYO key requirements so that only **Gemini** and **OpenRouter** models require a user-supplied API key. Direct OpenAI runs (including `gpt-5.1-codex-mini`) may omit `apiKey` and fall back to server `OPENAI_API_KEY` when configured.
  - **Implementation**:
    1. Updated `poetiqController.solve()` to require BYO keys only when the resolved provider/model is Gemini or OpenRouter; for other providers, requests without `apiKey` are accepted and rely on inherited env vars.
    2. Updated `/api/poetiq/models` metadata so that Gemini and OpenRouter entries set `requiresBYO: true`, while `gpt-5.1-codex-mini` is marked `requiresBYO: false`.
    3. Changed `PoetiqSolver` page defaults to use `gpt-5.1-codex-mini` as the default model and to treat the BYO key input as **optional** for direct OpenAI runs (while still required/visually enforced for Gemini/OpenRouter).
    4. Updated `PoetiqControlPanel` and `PoetiqCommunity` UI to reflect the new rules, showing "Required" badges only for Gemini/OpenRouter configurations and keeping project-key fallback messaging for other providers.
  - **Result**: Users can run Poetiq with GPT-5.1 Codex Mini using the server-level OpenAI key by default, while still being required to provide their own keys for higher-risk third-party providers (Gemini and OpenRouter).

### Version 5.32.2

- **Poetiq Solver: Direct SDK Routing Fix + Submodule Restore** (Author: Cascade using Cascade)
  - **Problem**: On the `arc3` branch, Poetiq runs with direct SDK integration were not hitting external APIs (especially OpenAI GPT-5.1 Codex Mini). BYO keys were being routed as `OPENROUTER_API_KEY` even for direct models like `gpt-5.1-codex-mini`, while the Python solver expected `OPENAI_API_KEY` for those models. This prevented real network calls and accurate token/cost tracking.
  - **Fix**:
    1. Updated `usePoetiqProgress.start()` so that the frontend only sends `provider: 'openrouter'` for models whose ID starts with `openrouter/`, and omits `provider` for direct models (OpenAI, Gemini, Anthropic, xAI). The backend now relies on `inferProviderFromModel(model)` to map BYO keys to the correct `*_API_KEY` env vars for the Python child process.
    2. Confirmed that `solver/poetiq/llm.py` and `server/python/poetiq_wrapper.py` correctly route GPT-5.x models to the OpenAI Responses API (`client.responses.create`) with reasoning parameters, and that token usage and cost are emitted back to the Node service.
    3. Restored the `poetiq-solver` git submodule as a **read-only reference** while keeping the internalized solver under `solver/poetiq/` as the execution path.
  - **Result**: Poetiq now correctly issues direct SDK calls for models like `gpt-5.1-codex-mini` using the caller's BYO key, and the UI/metrics pipeline once again receives accurate token and cost data. The original Poetiq repo is available as an in-repo reference via the submodule.

### Version 5.32.1

- **Poetiq Community Progress: Fix Iteration Count Metrics** (Author: Cascade using Claude Sonnet 4.5)
  - **Problem**: Iteration efficiency metrics were always showing "—" (no data) because `iteration_count` was hardcoded to `null` in the repository
  - **Fix**: Updated `getPoetiqExplanationsForPuzzles()` to query the existing `iteration_count` column from database
  - **Changes**:
    1. Added `iteration_count` to SQL SELECT query in `ExplanationRepository.ts:1258`
    2. Removed hardcoded `null` assignment, now properly maps `row.iteration_count` (line 1275)
    3. Controller already set up to pass iteration data through (no changes needed)
  - **Result**: "Iteration Efficiency" section on Community page now displays actual measured data:
    - Avg Iterations (Solved): Shows average iterations to solve puzzles
    - Avg Iterations (Failed): Shows average iterations before giving up
  - **Files Modified**:
    - `server/repositories/ExplanationRepository.ts:1258,1275` - Query and map `iteration_count` column

### Version 5.32.0 (BREAKING CHANGE)

- **Poetiq Solver: Complete Migration from LiteLLM to Direct SDK Calls** (Author: Cascade using Claude Sonnet 4)
  - **BREAKING CHANGE**: Removed LiteLLM dependency entirely from Poetiq solver
  - **Purpose**: Align Poetiq with main TypeScript services which already use direct SDK integration
  - **What Changed**:
    1. **OpenAI models** (GPT-5.x, o3, o4): Use Responses API (`POST /v1/responses`) with:
       - `reasoning: { effort, summary }` for chain-of-thought
       - `text: { verbosity }` for output control
    2. **Anthropic models** (Claude): Use Messages API via `@anthropic-ai/sdk` with:
       - Extended thinking support (`thinking: { type: "enabled", budget_tokens }`)
    3. **Google Gemini models**: Use Generative AI SDK via `google-generativeai` with:
       - Thinking config (`thinking_budget`) for Gemini 2.5+/3.x models
    4. **OpenRouter models**: Use OpenAI SDK with custom `base_url`
    5. **xAI (Grok) models**: Use OpenAI SDK with custom `base_url`
  - **Files Modified**:
    - `solver/poetiq/llm.py` - Complete rewrite with provider-specific functions (`llm_openai`, `llm_anthropic`, `llm_gemini`, `llm_openrouter`, `llm_xai`)
    - `solver/poetiq/__init__.py` - Updated documentation
    - `server/python/poetiq_wrapper.py` - Simplified to use unified `llm()` router, removed duplicate `llm_openai_responses`
    - `requirements.txt` - Removed `litellm>=1.50.0`
  - **Benefits**:
    - No more dependency on LiteLLM (simpler dependency tree)
    - Consistent architecture with TypeScript services
    - Better control over provider-specific features (reasoning, thinking)
    - Easier debugging with direct SDK calls

### Version 5.31.6

- **Poetiq Solver: Reasoning Traces Display** (Author: Cascade using Claude Sonnet 4)
  - **Feature**: Display reasoning summaries from OpenAI Responses API in the UI
  - **Changes**:
    1. `llm_openai_responses()` now returns reasoning summary as third tuple element
    2. Progress events include `reasoningSummary` field for GPT-5.x models
    3. New `reasoningSummaryHistory` state in `usePoetiqProgress` hook
    4. **Reasoning Traces panel** in UI (amber-themed, collapsible):
       - Shows chain-of-thought summaries from GPT-5.x
       - Button appears only when summaries are available
       - Displays iteration/expert markers with summary content
    5. WebSocket service forwards `reasoningSummary` to frontend
  - **Files Modified**:
    - `server/python/poetiq_wrapper.py` - Return and emit reasoning summary
    - `server/services/poetiq/poetiqService.ts` - Forward reasoningSummary in broadcasts
    - `client/src/hooks/usePoetiqProgress.ts` - Add reasoningSummaryHistory state
    - `client/src/pages/PoetiqSolver.tsx` - Reasoning Traces toggle and panel

### Version 5.31.5

- **Poetiq Solver: Direct OpenAI Responses API Integration** (Author: Cascade using Claude Sonnet 4)
  - **Problem**: Users could not see what prompts were being sent to the AI, and GPT-5.1 Codex Mini was incorrectly using litellm's ChatCompletions API instead of OpenAI's Responses API with proper reasoning parameters.
  - **Critical Fix**: 
    - **Direct OpenAI Responses API** implemented for GPT-5.x, o3, o4 models
    - Now uses `client.responses.create()` with proper parameters:
      - `input` (not `messages`) for Responses API format
      - `reasoning: { effort: "high", summary: "detailed" }` for GPT-5.x
      - `text: { verbosity: "high" }` for detailed output
      - `max_output_tokens: 128000` for full reasoning capacity
      - `store: true` and `include: ["reasoning.encrypted_content"]` for state preservation
  - **Changes**:
    1. **`llm_openai_responses()` function** (new in `poetiq_wrapper.py`):
       - Calls OpenAI Responses API directly via `openai.AsyncOpenAI()`
       - Properly parses `response.output[]` array for message content
       - Extracts reasoning tokens from `usage.output_tokens_details`
       - Logs response_id for potential chaining
    2. **API Routing** in `instrumented_solve_coding()`:
       - Detects if model should use direct OpenAI (`get_api_routing()`)
       - Routes GPT-5.1-codex-mini, o3-mini, o4-mini to Responses API
       - Routes OpenRouter and other models to litellm (ChatCompletions)
    3. **Prompt Inspector UI** (new feature):
       - Collapsible "Prompts" button shows system/user prompts
       - Displays model, temperature, provider, API style, reasoning params
    4. **Provider Badge in Header**:
       - Shows "🔗 Direct OpenAI" (green) or "🔀 OpenRouter" (amber)
       - Displays API style ("Responses API" vs "ChatCompletions API")
    5. **Service Updates** (`poetiqService.ts`):
       - Added `'openai'` as valid provider type
       - Added `isDirectOpenAIModel()` and `inferProviderFromModel()` methods
       - Ensures `OPENAI_API_KEY` is passed to Python subprocess
  - **Files Modified**:
    - `server/python/poetiq_wrapper.py` - `llm_openai_responses()`, API routing
    - `server/services/poetiq/poetiqService.ts` - OpenAI provider support
    - `server/controllers/poetiqController.ts` - reasoningEffort extraction
    - `client/src/hooks/usePoetiqProgress.ts` - PromptData interface
    - `client/src/pages/PoetiqSolver.tsx` - Prompt Inspector, Provider Badge
  - **Plan Document**: `docs/plans/2025-11-27-poetiq-api-improvements-plan.md`

### Version 5.31.4

- **Plan: Enforce User-Provided API Keys for Third-Party Providers** (Author: GPT-5.1 via Codex)
  - **Purpose**: Define a safe path to require users to enter their own API keys (e.g., Gemini, OpenRouter) instead of silently falling back to project-level keys, while preserving all existing secure behavior and flows that already work.
  - **Scope**:
    - Backend: Remove silent project-key fallback for user-facing requests, introduce explicit "API key required" errors, and keep project keys only for system-level tasks.
    - Frontend: Show clear prompts when a user key is missing and guide users to the existing API key/settings screen to add or update their keys.
    - Testing & Docs: Add coverage and documentation updates so the new requirement is clearly specified and verifiable.
  - **Plan Doc**: See `docs/2025-11-28-require-user-api-key-plan.md` for detailed steps, assumptions, and test strategy.

### Version 5.31.3

- **Poetiq Solver Training Examples Display Fix** (Author: Cascade using Claude Sonnet 4)
  - **Problem**: Training examples section in PoetiqSolver showed empty space instead of actual grid content
  - **Root Cause**: PoetiqSolver was using `TinyGrid` component instead of the project's standard `PuzzleGrid` component
  - **Fix**: 
    - Replaced `TinyGrid` with `PuzzleGrid` component to match rest of project
    - Added required props: `title`, `compact`, `maxWidth`, `maxHeight`, `showEmojis`, `showColorOnly`, `emojiSet`
    - Fixed TypeScript errors by adding missing `title` prop to both input and output grids
  - **Files Modified**: `client/src/pages/PoetiqSolver.tsx`
  - **Impact**: Training examples now properly display input→output grid pairs in the right-side panel before solver starts

### Version 5.31.2

- **Poetiq Deployment Fix - Remove Submodule Cloning** (Author: Cascade using Claude Sonnet 4)
  - **CRITICAL BUG**: Dockerfile was still cloning the old `poetiq-solver` submodule, but `poetiq_wrapper.py` now expects `solver/poetiq/`. This would cause deployment failures.
  - **Fixes**:
    - `Dockerfile` - Removed `git clone` of old submodule, added verification of internalized solver at `solver/poetiq/`
    - `.gitmodules` - Removed poetiq-solver submodule entry (with historical note)
    - `setup-poetiq.sh` - Updated to check for `solver/poetiq/` instead of old `poetiq-solver/arc_agi/`
    - `solver/poetiq/__init__.py` - Fixed docstring to correctly describe litellm usage
  - **Note**: The old `poetiq-solver/` directory may still exist locally. It can be safely deleted with `git rm -r poetiq-solver` and `rm -rf poetiq-solver`.

### Version 5.31.1

- **Poetiq Community Page: Cost Efficiency Metrics & Layout Redesign** (Author: Claude Code using Haiku 4.5)
  - **Purpose**: Add cost tracking to validate Poetiq's Pareto Frontier claims about accuracy-to-cost ratios
  - **Changes**:
    1. **Cost Efficiency Metrics** (validates Pareto claims):
       - **Coverage**: `attempted / total` showing % of dataset tested
       - **Success Rate**: `solved / attempted` showing effectiveness on tested puzzles
       - **Total Cost**: Cumulative cost across all attempts
       - **Cost per Solve**: Average cost for successful solves (accuracy-to-cost ratio)
       - **Cost per Attempt**: Average cost including failures
    2. **Backend Enhancement**:
       - Updated `ExplanationRepository.getPoetiqExplanationsForPuzzles()` to return cost data
       - Added `inputTokens`, `outputTokens`, `totalTokens`, `estimatedCost` to query results
       - Modified `poetiqController.getCommunityProgress()` to pass cost data to frontend
    3. **Hook Enhancements** (`usePoetiqCommunityProgress.ts`):
       - Added cost fields to `PoetiqPuzzleStatus` interface
       - Calculate `totalCost`, `avgCostPerSolve`, `avgCostPerAttempt` from puzzle data
       - Removed useless `modelStats` breakdown (no expert count metadata available)
    4. **PoetiqCommunity.tsx Redesign**:
       - Moved explanations (Technical Definitions + Deep Dive sections) to top
       - Replaced simple counter with 5-card metrics panel showing cost efficiency
       - Removed per-model stats table (replaced with cost metrics)
       - Moved puzzle grid to bottom as "Puzzle Status"
    5. **PuzzleProgressGrid.tsx Navigation Fix**:
       - Changed puzzle badge destination from `/puzzle/poetiq/{puzzleId}` to `/puzzle/{puzzleId}`
       - Users navigate to Puzzle Explainer instead of Poetiq solver
    6. **PoetiqSolver.tsx Training Grid Display**:
       - Added training examples to right-side panel
       - Shows input→output pairs before running, replaced by event log when solver starts
  - **Files Changed**:
    - `server/repositories/ExplanationRepository.ts` (cost data query)
    - `server/controllers/poetiqController.ts` (cost data passthrough)
    - `client/src/hooks/usePoetiqCommunityProgress.ts` (cost calculations)
    - `client/src/pages/PoetiqCommunity.tsx` (cost metrics display)
    - `client/src/components/poetiq/PuzzleProgressGrid.tsx` (navigation fix)
    - `client/src/pages/PoetiqSolver.tsx` (training grid display)

### Version 5.31.0

- **Poetiq Solver - Comprehensive Token & Cost Tracking** (Author: Cascade using Claude Sonnet 4)
  - **Purpose**: Independent audit capability for Poetiq's Pareto Frontier cost claims
  - **Implementation**: Enhanced `server/python/poetiq_wrapper.py` with full token/cost tracking
    - **Cost Calculator**: Added MODEL_PRICING table mirroring `server/config/models.ts` (per-1M-token pricing)
    - **Model Normalizer**: Handles litellm provider prefixes (openai/, gemini/, anthropic/, openrouter/)
    - **Per-Iteration Tracking**: Captures token usage from every LLM API call via `llm()` function
    - **Per-Expert Aggregation**: Each expert's total tokens/cost tracked separately
    - **Global Aggregation**: Sum across all experts for puzzle-level totals
  - **Enhanced llm.py**: Modified `solver/poetiq/llm.py` to return token_usage as 5th tuple element
    - Original Poetiq discarded `resp.usage` - we now capture: `input_tokens`, `output_tokens`, `total_tokens`
    - Backward-compatible wrapper (`llm_compat`) for code expecting old 4-element return
  - **Progress Events**: Real-time token/cost streaming to frontend
    - `tokenUsage`: Per-iteration token counts
    - `cost`: Per-iteration cost breakdown (input/output/total)
    - `expertCumulativeTokens`/`expertCumulativeCost`: Running totals for this expert
    - `globalTokens`/`globalCost`: Running totals across all experts
  - **Final Result Schema**: Added to `run_poetiq_solver()` return value:
    - `tokenUsage`: {input_tokens, output_tokens, total_tokens}
    - `cost`: {input, output, total} in USD
    - `expertBreakdown`: Per-expert token/cost data for multi-expert runs
  - **Audit Documentation**: Created `docs/2025-11-27-arc-agi-token-cost-tracking-analysis.md`
    - Compares ARC-AGI benchmarking framework's token tracking (gold standard)
    - Documents Poetiq's dashboard-only approach (no programmatic tracking)
    - Identifies verification gaps in Poetiq's Pareto Frontier claims
    - Proposes audit methodology using our instrumented wrapper
  - **Benefits**:
    - ✅ Verifiable per-puzzle cost attribution (unlike Poetiq's dashboard approach)
    - ✅ Per-expert cost breakdowns (critical for multi-expert configs)
    - ✅ Real-time cost visibility during execution
    - ✅ Programmatic validation of cost claims
    - ✅ Independent audit trail for research/publication

### Version 5.30.0

- **Poetiq Solver Internalization - Enhanced Token Tracking** (Author: Cascade using Claude Sonnet 4)
  - **Architecture**: Moved Poetiq solver from git submodule (`poetiq-solver/`) into `solver/poetiq/`, keeping litellm for multi-provider routing (faithful to original Poetiq).
  - **KEY FIX**: Original Poetiq discarded `resp.usage` token data - we now capture and return it! This enables cost tracking without changing the underlying architecture.
  - **SDK Backends Installed**: Added all SDK backends that litellm needs:
    - `litellm>=1.50.0` - Multi-provider router (kept from original)
    - `google-generativeai>=0.8.0` - Gemini backend
    - `openai>=1.0.0` - OpenAI/GPT backend  
    - `anthropic>=0.40.0` - Claude backend
  - **Files Created in `solver/poetiq/`**:
    - `__init__.py` - Package exports
    - `types.py` - TypedDict definitions (ExpertConfig, ARCAGIResult, TokenUsage)
    - `utils.py` - Utility functions
    - `sandbox.py` - Sandboxed code execution
    - `scoring.py` - Kaggle-format scoring
    - `io.py` - I/O utilities
    - `prompts.py` - Solver prompt templates
    - `config.py` - Default configuration
    - `llm.py` - **Enhanced** litellm-based implementation with token usage capture
    - `solve_coding.py` - Iterative code generation loop (accumulates token usage)
    - `solve_parallel_coding.py` - Parallel expert orchestration and voting
    - `solve.py` - Main entry point
  - **Updated Files**:
    - `server/python/poetiq_wrapper.py` - Now imports from `solver.poetiq` instead of submodule
    - `requirements.txt` - Added all SDK backends
  - **Benefits**:
    - **Faithful replication** of original Poetiq behavior via litellm
    - **Token usage tracking** for cost analysis (previously discarded!)
    - **Multi-provider support** - works with Gemini, OpenAI, Anthropic, xAI, OpenRouter
    - No external submodule dependency
  - **Plan Documents**: 
    - `docs/plans/2025-11-27-poetiq-internalization-plan.md`
    - `docs/plans/2025-11-27-poetiq-internalization-revised-plan.md`

### Version 5.29.15

- **Poetiq LLM Temperature Guidance** (Author: Codex (GPT-5))
  - Added a lightweight plan plus a full write-up explaining how the Poetiq integration keeps LiteLLM-based requests provider-agnostic, why the solver defaults to `temperature = 1.0`, and how each vendor clamps randomness (Gemini, GPT-5, Grok, Anthropic, OpenRouter mirrors).
  - Document answers the “isn’t that high?” question from the Poetiq audit notes and calls out the relevant code paths (`PoetiqSolver.tsx`, `poetiqController.ts`, `poetiq_wrapper.py`, `arc_agi/llm.py`, `openai/payloadBuilder.ts`, and `server/config/models.ts`).
  - **Files**: `docs/2025-11-27-llm-temperature-doc-plan.md`, `docs/poetiq-llm-agnostic-temperature-guide.md`

### Version 5.29.14

- **Poetiq Parser Alignment** (Author: Codex (GPT-5))
  - `poetiqService.transformToExplanationData` now feeds results plus the loaded `ARCTask` through the shared `responseValidator`, so the same grid parser/cleaner used by Saturn/Grover sanitizes Poetiq predictions (fixes stray newline artifacts and ensures multi-test arrays match our schema).
  - Stored provider metadata now includes validator traces and normalized raw predictions for future audits; controllers pass puzzle context into the transformer to unlock this validation.
  - Added a short plan doc covering the parser alignment work.
  - **Files**: `server/services/poetiq/poetiqService.ts`, `server/controllers/poetiqController.ts`, `docs/2025-11-27-poetiq-parser-alignment-plan.md`

### Version 5.29.13

- **Poetiq Confidence Suppression** (Author: Codex (GPT-5))
  - Hard-coded Poetiq explanation transforms to store `confidence = 0` and `trustworthinessScore = null` so UI cards stop surfacing misleading metrics for meta-system runs.
  - Added accompanying implementation plan to document why these fields are intentionally blanked.
  - **Files**: `server/services/poetiq/poetiqService.ts`, `docs/2025-11-27-poetiq-confidence-suppression-plan.md`

### Version 5.29.12

- **Poetiq Model Metadata Persistence** (Author: Codex (GPT-5))
  - Ensured every Poetiq run stores the actual selected model/provider combination just like Saturn/Grover: Python wrapper now reports its in-memory config without relying on undefined globals, and the TypeScript service enriches final results with sanitized run options before persisting.
  - `transformToExplanationData` now slugs the full model id (`openrouter/google/gemini-3-pro-preview` → `poetiq-openrouter-google-gemini-3-pro-preview`) so analytics can differentiate OpenRouter vs direct calls, and providerRawResponse keeps the enriched config blob.
  - Added a focused implementation plan record for this fix under `docs/`.
  - **Files**: `server/python/poetiq_wrapper.py`, `server/services/poetiq/poetiqService.ts`, `docs/2025-11-27-poetiq-model-agnostic-plan.md`

### Version 5.29.11

- **Poetiq Solver UI Redesign** (Author: Cascade using Claude Sonnet 4)
  - **Problem**: User feedback identified several UX issues:
    1. Tiny gear icon hid valuable configuration settings
    2. Top header bar was wasted space showing only title
    3. "Python Execution" terminal label was confusing
    4. Model selection showed misleading routing info ("Direct" when using OpenRouter)
    5. Start button looked like plain text, not clickable
  - **Header Redesign**: 
    - Gradient indigo/purple header with key metrics inline (Status, Iteration, Elapsed, Phase)
    - Stop button integrated into header when running
    - No more wasted space
  - **Controls Always Visible**: Removed collapsible gear icon - settings are now always shown prominently
  - **Prominent Start Button**:
    - Large green gradient button with Rocket + Zap icons
    - Clear visual weight, not mistakable for plain text
    - Red variant when stopping
  - **Clear Routing Indicators**:
    - Blue badge: "Via OpenRouter (Uses Server Key)"
    - Amber badge: "Direct API to [Provider] (Requires Your API Key)"
    - Models marked with "(BYO Key)" in dropdown when direct API required
  - **Renamed Terminal Panel**:
    - Changed "PYTHON EXECUTION" → "ITERATION PROGRESS"
    - Added subtitle: "Code generation & testing results per iteration"
    - Clearer purpose without technical jargon
  - **Backend Model List Updated** (`poetiqController.ts`):
    - Added `routing` and `requiresBYO` fields to model definitions
    - Removed misleading "(Direct)" labels from model names
  - **Files Modified**:
    - `client/src/pages/PoetiqSolver.tsx` - Header, layout, controls visibility
    - `client/src/components/poetiq/PoetiqControlPanel.tsx` - Start button, routing indicators
    - `client/src/components/poetiq/PoetiqPythonTerminal.tsx` - Renamed and clarified
    - `server/controllers/poetiqController.ts` - Model metadata with routing info
    - `docs/plans/2025-11-27-poetiq-visibility-debug-plan.md` - Added UI redesign section

### Version 5.29.10

- **Poetiq UI Timing & Event Visibility** (Author: Cascade using Claude Sonnet 4)
  - **Metrics bar expanded** to 6 columns: Iteration, Phase, Status, Elapsed Time, Last Update, Event Count
  - **Elapsed time** shows running clock (MM:SS format) while solver is active
  - **Last Update** shows how long since last event - turns orange if >30s (potential hang indicator)
  - **Event Log panel** - collapsible panel showing all timestamped events in real-time
  - **LIVE indicator** pulses green when events are streaming
  - Helps diagnose if solver is hanging vs. just slow
  - **Files**: `client/src/pages/PoetiqSolver.tsx`

### Version 5.29.9

- **Dockerfile Fix for Poetiq Submodule** (Author: Cascade using Claude Sonnet 4)
  - **Problem**: Poetiq solver failed on Railway with "arc_agi/solve.py not found" because git submodules don't work with Docker COPY
  - **Solution**: Added `git` to Alpine packages and replaced `COPY poetiq-solver/` with `git clone` of the submodule repo
  - Added verification step to fail build early if `solve.py` is missing
  - **Files**: `Dockerfile`

### Version 5.29.8

- **Poetiq UI Fixes** (Author: Cascade using Claude Sonnet 4)
  - **Fixed nested `<a>` tags** in `PoetiqSolver.tsx` - wouter `Link` already renders an anchor, so nested `<a>` was causing React DOM warning
  - **Fixed undefined phase issue** - Log events now include `phase: 'log'` to prevent frontend state corruption
  - **Improved debug logging** - WebSocket handler now logs both wrapper type and actual data type
  - **Files**: `client/src/pages/PoetiqSolver.tsx`, `server/services/poetiq/poetiqService.ts`, `client/src/hooks/usePoetiqProgress.ts`

### Version 5.29.7

- **Poetiq Visibility Parity with Saturn** (Author: Cascade using Claude Sonnet 4)
  - **Problem**: Poetiq UI stayed blank after clicking "Run" because events weren't reaching the frontend properly.
  - **Frontend Hook Fixes** (`usePoetiqProgress.ts`):
    - Seed UI state synchronously BEFORE network calls (Saturn pattern) for immediate visual feedback
    - Initialize all buffers (logLines, reasoningHistory, pythonLogLines, streamingReasoning, streamingCode)
    - Fixed WebSocket handler to accumulate content properly instead of relying on message changes
    - Handle ALL event types (progress, log, start, error) not just progress
    - Cap buffers (500 log lines, 100 reasoning entries) to prevent memory bloat
  - **Python Wrapper Fixes** (`poetiq_wrapper.py`):
    - Moved `emit()` and `log()` functions to top of file (were called before definition)
    - Added detailed preflight error messages with remediation hints
    - Enhanced start event with model/experts/iterations metadata
    - Added initializing progress event for immediate UI feedback
  - **Backend Service Fixes** (`poetiqService.ts`):
    - Broadcast ALL event types (start, progress, log, error) to WebSocket, not just progress
    - Forward non-JSON stdout as log events so AI model responses appear in UI
    - Forward stderr as error log events
    - Added eventTrace collection like Saturn for debugging
  - **Controller Cleanup** (`poetiqController.ts`):
    - Removed duplicate WebSocket broadcasting (service now handles it)
    - Controller callback now only logs to console for all event types
  - **Files**: `client/src/hooks/usePoetiqProgress.ts`, `server/python/poetiq_wrapper.py`, `server/services/poetiq/poetiqService.ts`, `server/controllers/poetiqController.ts`

### Version 5.29.6

- **Poetiq WebSocket Debug Logging** (Author: Cascade using Claude Sonnet 4.5)
  - Added detailed error logging to `usePoetiqProgress.ts` to show error data when Python process fails (line 169)
  - Added WebSocket close event logging with close code and current state (line 183)
  - Added environment variable debugging in `poetiqService.ts` to verify API keys are reaching Python subprocess (line 177-178)
  - These logs will help diagnose why WebSocket closes immediately after connecting
  - **Files**: `client/src/hooks/usePoetiqProgress.ts`, `server/services/poetiq/poetiqService.ts`

### Version 5.29.5

- **Poetiq Visibility & Streaming Debug Plan** (Author: Codex / GPT-5)
  - Added detailed recovery plan to surface all Poetiq solver signals (reasoning/code/logs/errors) end-to-end, using SaturnVisualSolver as the gold-standard reference.
  - Documents chokepoints (Python preflight, WebSocket forwarding, session plumbing, UI expectations) and phased fixes plus acceptance criteria to avoid silent failures.
  - **Files**: `docs/plans/2025-11-27-poetiq-visibility-debug-plan.md`

### Version 5.29.4

- **Poetiq UI/UX Fixes & Content Audit** (Author: Cascade using Claude Sonnet 4.5)
  - **API Key Input Type Fix**: Changed from `type="password"` to `type="text"` in both `PoetiqCommunity.tsx:221` and `PoetiqControlPanel.tsx:283` to eliminate browser password field warnings (API keys are not passwords)
  - **Missing State Variable**: Added `reasoningEffort` state variable in `PoetiqSolver.tsx:39` that was previously undefined, preventing solver from starting
  - **API Key Security**: Removed all validation logic in `poetiqController.ts:143-146` - now accepts any user-provided key without validation or modification. Security measures confirmed:
    - API key passed only via environment variables to Python subprocess (never logged, never stored, never broadcast via WebSocket)
    - Only `usingFallback` flag sent to client (boolean indicating if server key is used)
    - Key exists only in memory for duration of Python process execution
  - **Content Audit**: Updated `PoetiqCommunity.tsx` to maintain professional, educational tone as independent community auditors:
    - Added "Technical Definitions" card (lines 269-308) with clear explanations of "Pareto Frontier" and "Recursive Self-Improving Meta-System"
    - Clarified auditor role: "We are not affiliated with Poetiq. We are independent community members auditing their claims..."
    - Removed marketing language: Changed "delivering higher accuracy" → "achieving better accuracy-to-cost ratios than prior reported results"
    - Fixed GPT-5.1 label: Removed "Preview" variant (line 347) - it's not a preview model
    - Updated all model descriptions to factual statements (e.g., "Latest Google model used in reported SOTA configurations")
  - **Files**: `client/src/pages/PoetiqCommunity.tsx`, `client/src/pages/PoetiqSolver.tsx`, `client/src/components/poetiq/PoetiqControlPanel.tsx`, `server/controllers/poetiqController.ts`

### Version 5.29.3

- **Poetiq Solver "Saturn-Grade" Live Feedback** (Author: Cascade using Claude Sonnet 4.5)
  - **Goal**: Match Saturn's dynamic information density for the Poetiq Meta-System.
  - **Backend Instrumentation**: Monkey-patched `poetiq_wrapper.py` to emit real-time events from inside the solver loop (reasoning, code generation, training eval results).
  - **Rich WebSocket Protocol**: Forwarding `expert_id`, full `reasoning` trace, parsed `code`, and granular `trainResults` to frontend.
  - **Dynamic Terminal UI**:
    - **Real-Time Expert Tracking**: Shows "Iter X | Exp Y" updates as they happen.
    - **Live Training Results**: Visual "traffic light" indicators (green/red dots) for each training example.
    - **Code Inspection**: Collapsible code blocks to view the actual Python code generated by each expert.
    - **Stable Log**: Uses upsert logic to update cards in-place rather than spamming the log.
  - **Files**: `poetiq_wrapper.py`, `poetiqService.ts`, `usePoetiqProgress.ts`, `PoetiqPythonTerminal.tsx`, `PoetiqSolver.tsx`

### Version 5.29.2

- **Poetiq Integration Audit & Meta-System Update** (Author: Cascade using Claude Sonnet 4.5)
  - **Deep Dive Audit**: Verified Poetiq's "Meta-System" claims and "LLM-agnostic" architecture against open-source code and blog post.
  - **Merged Community Page**: Merged `PoetiqExplainer` into `PoetiqCommunity` for a single, comprehensive audit landing page.
  - **New SOTA Models**: Added Grok 4 Fast (xAI), GPT-OSS 120B (OpenRouter), and GPT-5.1 (OpenRouter) to the solver's model list, reflecting the blog post's specific configurations.
  - **Terminology Update**: Updated `PoetiqSolver` to use "Meta-System" terminology and clarified Expert configurations (Config A/B/C) instead of model-specific names.
  - **Verification**: Ensured all models use verified keys from `models.ts` - no placeholders.
  - **Files**: `PoetiqCommunity.tsx`, `PoetiqSolver.tsx`, `PoetiqControlPanel.tsx`, `poetiqController.ts`

### Version 5.29.1

- **HTTPS Security Fix for Poetiq Solver** (Author: Cascade using Claude Sonnet 4)
  - **Problem**: Railway's reverse proxy terminates SSL, causing `req.protocol` to report `http` even when client used HTTPS
  - **Solution**: Added `app.set('trust proxy', 1)` and fallback to check `X-Forwarded-Proto` header
  - **File**: `server/index.ts` - middleware now correctly detects HTTPS through proxy
  - **Impact**: Fixes 400 "HTTPS required" error when passing API keys from community to solver page

- **Improved Poetiq Solver UX - Collapsible Controls** (Author: Cascade using Claude Sonnet 4)
  - **Problem**: Users auto-starting from community page had to see large control panel they already configured
  - **Solution**: Compact status header with settings toggle, auto-hide controls when coming from community
  - **Features**:
    - Always-visible compact status (READY/RUNNING/COMPLETED/ERROR) with iteration counter
    - Settings gear button to toggle full control panel
    - Auto-start message "Auto-starting with community settings..."
    - API key now truly optional - server falls back to project key
  - **File**: `client/src/pages/PoetiqSolver.tsx`

### Version 5.29.0

- **Poetiq solver defaults to OpenRouter** (Author: Codex (GPT-5))
  - `server/python/poetiq_wrapper.py`: now treats `OPENROUTER_API_KEY` as a first-class credential, logs its availability, and defaults the LiteLLM model id to `openrouter/google/gemini-3-pro-preview` so BYO keys and server keys hit the proxy instead of direct Gemini.
  - `run-poetiq-batch.js`: batch runs log the OpenRouter model and no longer hardcode the direct Gemini variant.
- **UI + hooks send the correct LiteLLM ids** (Author: Codex (GPT-5))
  - `client/src/hooks/usePoetiqModels.ts`: new hook that calls `/api/poetiq/models` so the control panel always gets solver-ready ids.
  - `client/src/components/poetiq/PoetiqControlPanel.tsx`, `client/src/hooks/usePoetiqProgress.ts`, `client/src/pages/PoetiqSolver.tsx`: default provider/model now point at the OpenRouter Gemini proxy and provider switching reuses the new hook data.
  - `client/src/pages/PoetiqCommunity.tsx`: sessionStorage auto-start config stores the OpenRouter id (`openrouter/google/gemini-3-pro-preview`) and the direct fallback (`gemini/gemini-3-pro-preview`) so solver runs align with LiteLLM expectations.
- **Docs**
  - `poetiq-solver/README.md`: documents `OPENROUTER_API_KEY` + `USE_OPENROUTER=true` as the recommended setup, with Gemini/OpenAI keys kept as fallbacks.

### Version 5.28.9

- **Poetiq UX - Navigate to Solver for Full Feedback** (Author: Cascade using Claude Sonnet 4)
  - **Problem**: Community page had minimal feedback - no Python terminal, no streaming boxes
  - **Solution**: Community page now navigates to full solver page for rich feedback
    - Saves config to sessionStorage (apiKey, provider, model, experts)
    - Solver page auto-reads config and auto-starts
    - User sees full Python execution terminal, AI reasoning streaming, code generation
  - **Renamed**: "Poetiq Code Generator" → "Poetiq Solver" (header title)
  - **Files**: `PoetiqCommunity.tsx`, `PoetiqSolver.tsx`

### Version 5.28.8

- **Fix Poetiq Pages - Dynamic Models from API** (Author: Cascade using Claude Sonnet 4)
  - **Solver page** (`/puzzle/poetiq/:taskId`):
    - Uses `useModels()` hook to fetch ALL models from `/api/models` endpoint
    - Groups by provider (OpenRouter, OpenAI, Gemini)
    - No hardcoded model lists - uses actual server config
    - Shows 🧠 for reasoning models
  - **Community page** (`/poetiq`):
    - Locked to Gemini 3 Pro Preview model
    - Now allows BOTH OpenRouter AND Gemini Direct providers
    - Added provider dropdown (same model, choice of API)
  - **Both pages**: Expert options 1, 2, 8 only (Gemini-3-a/b/c)
  - **Files**: `PoetiqControlPanel.tsx`, `PoetiqCommunity.tsx`

### Version 5.28.7

- **Differentiate Poetiq Pages - Community vs Solver** (Author: Cascade using Claude Sonnet 4)
  - **Clarification**: Two different Poetiq pages with different purposes:
    - `/poetiq` (Community) - Locked to Gemini 3 Pro Preview via OpenRouter only
    - `/puzzle/poetiq/:taskId` (Solver) - Allows ANY provider/model selection
  - **Solver page restored**: Full provider/model/temperature selection
  - **Community page**: Stays locked to Gemini 3 Pro Preview
  - **Both pages**: Expert options 1, 2, 8 only (Gemini-3-a/b/c)
  - **Files**: `PoetiqControlPanel.tsx`, `PoetiqSolver.tsx`

### Version 5.28.6

- **Fix PoetiqCommunity Page - Use Actual Config** (Author: Cascade using Claude Sonnet 4)
  - **Problem**: Community page (/poetiq) still had wrong models and "4 experts" option
  - **Fix**: 
    - Locked to `google/gemini-3-pro-preview` via OpenRouter (same as control panel)
    - Expert options: 1, 2, 8 ONLY (Gemini-3-a, Gemini-3-b, Gemini-3-c)
    - Removed provider selector (was showing Gemini Direct option)
    - Removed model selector (was showing outdated models)
    - Added teal info card showing fixed model
  - **Files**: `PoetiqCommunity.tsx`

### Version 5.28.5

- **Fix Poetiq Control Panel - Use Actual Config** (Author: Cascade using Claude Sonnet 4)
  - **Problem**: Control panel had hallucinated model lists (GPT-5, etc.) instead of actual Poetiq config
  - **Fix**: 
    - Poetiq ONLY uses `google/gemini-3-pro-preview` via OpenRouter (hardcoded in config.py)
    - Expert options fixed to 1, 2, 8 ONLY (Gemini-3-a, Gemini-3-b, Gemini-3-c) - removed invalid "4 experts"
    - Removed fake provider/model dropdowns - model is fixed
    - Simplified control panel to: API key (optional), Expert config, Max iterations
  - **Files**: `PoetiqControlPanel.tsx`, `PoetiqSolver.tsx`

### Version 5.28.4

- **GPT-5.1 Codex Mini Support** (Author: Codex (GPT-5))
  - `server/config/models.ts`: Added the OpenAI listing for `gpt-5.1-codex-mini` with cost ($0.25 / $2 per million tokens), 400k context, 128k max output, reasoning-token note, and preview release metadata so UI+server selectors surface it like other GPT-5-class models.
  - `server/services/openai.ts`: Registered the new key for routing plus streaming support, ensuring Responses API streaming + schema lookup flows treat GPT-5.1 Codex Mini identically to other GPT-5 reasoning models.

### Version 5.28.3

- **Gemini 3 Pro Preview (Direct) Enablement** (Author: Codex (GPT-5))
  - `docs/2025-11-26-gemini-3-pro-preview-plan.md`: Captured the direct-Gemini rollout goal, impacted files, and risk notes for adding `gemini-3-pro-preview`.
  - `server/config/models.ts`: Added a first-party `Gemini` provider entry for `gemini-3-pro-preview` (maps to `models/gemini-3-pro-preview`, reasoning-capable, structured-output disabled, streaming turned off) so UI + routing logic can surface the direct Google option beside the existing OpenRouter variant.
  - `server/services/gemini.ts`: Registered the new key and generalized the reasoning/thinking detection + generation config helpers so Gemini 3 models inherit the same thinking budget handling and capability reporting as 2.5-series models.

### Version 5.28.2

- **Poetiq ARC2 Batch Runner Update** (Author: Codex (GPT-5))
  - Script now targets the first 20 ARC2-Eval puzzles automatically so batch runs match the latest request volume.
  - Default expert count increased to two, aligning with the desired Poetiq multi-expert configuration.
  - Logging is ASCII-only and progress/summary metrics now derive from the actual puzzle count (no more hard-coded `/10` output).
  - Added guardrails for missing `sessionId` and failed status polls to surface actionable errors instead of silent hangs.

### Version 5.28.1

- **Poetiq API Key Fallback & Streaming Fields** (Author: Cascade using Claude Sonnet 4)
  - **API Key Now Optional**: Users can start solver without providing an API key
  - **Fallback Behavior**: When API key is missing/invalid, server uses its environment variables
  - **UI Updates**: 
    - Control panel shows "API Key (Optional)" with explanation
    - Fallback notice shown in streaming panel when using server key
    - Placeholder text indicates "(optional)" in all API key fields
  - **Hook Updates**: Added streaming fields to `usePoetiqProgress`:
    - `streamingText`, `streamingReasoning`, `streamingCode`
    - `logLines` array for activity tracking
    - `usingFallback` indicator
  - **Server Updates**: `poetiqController` validates API key format, falls back gracefully

### Version 5.28.0

- **Major Poetiq UI Overhaul - Saturn's Exact Layout Pattern** (Author: Cascade using Claude Sonnet 4)
  - **Goal**: Match Saturn's information density with Python terminal output instead of image gallery
  - **Layout**: Saturn's exact 12-column grid: LEFT (4 cols) + CENTER (5 cols) + RIGHT (3 cols)
  
  **New Components Created:**
  - `PoetiqControlPanel.tsx` - Saturn-style visible controls (NO collapsing), GPT-5 Nano/Mini options, reasoning effort settings
  - `PoetiqPythonTerminal.tsx` - Python execution terminal showing test results, errors, generated code (replaces Saturn's image gallery)
  - `PoetiqStreamingVisualizer.tsx` - Saturn-style streaming display
  - `PoetiqStreamingModal.tsx` - Grover-style pop-out modal
  - `PoetiqLiveActivityStream.tsx` - Activity log with color-coded entries
  
  **PoetiqSolver.tsx - Saturn's Exact Layout:**
  - **LEFT (4 cols)**: Control panel cards + puzzle grids (training/test)
  - **CENTER (5 cols)**: Token metrics bar + AI REASONING (blue box) + GENERATED CODE (green box)
  - **RIGHT (3 cols)**: Python execution terminal with iteration results
  
  **Key Features Matching Saturn:**
  - Token/metrics bar at top of center column
  - Dual streaming boxes: AI REASONING (blue) + AI OUTPUT (green)
  - All controls visible by default (no collapse)
  - GPT-5 Nano (Recommended) and GPT-5 Mini model options
  - Reasoning effort configuration for GPT-5 models
  - OpenAI Direct, OpenRouter, and Gemini Direct providers
  
  **Plan Document**: `docs/plans/2025-11-26-poetiq-improvement-plan.md`

### Version 5.27.4

- **Fix Poetiq Railway Deployment - Handle Missing Submodule** (Author: Cascade using Claude Sonnet 4)
  - **Issue**: Railway build fails because git submodule (poetiq-solver) not included in build context
  - **Root Cause**: Railway's Docker build doesn't automatically include git submodules
  - **Fix 1**: Added Poetiq dependencies to main requirements.txt (litellm, asynciolimiter, scipy)
  - **Fix 2**: Added graceful error handling in poetiq_wrapper.py for missing submodule
  - **Fix 3**: Clear error message to users when Poetiq not available
  - **Impact**: Build now succeeds, Poetiq shows helpful error if submodule missing

### Version 5.27.3

- **Fix Poetiq Community Page UX - Actually Start Solver** (Author: Cascade using Claude Sonnet 4)
  - **Bug**: "Run Solver" button just navigated to another page, losing user's API key and settings
  - **Root Cause**: `handleRunNext()` only called `navigate()` instead of starting the solver
  - **Fix**: Button now starts solver directly on the community page with inline progress display
  - **Added**: Live progress panel showing status, iteration progress bar, and results
  - **Added**: Auto-refresh of puzzle grid after solver completes
  - **Added**: Visual feedback with spinner during solving, checkmark/x on completion
  - **Impact**: Users can now enter API key once and watch solver progress without leaving the page

### Version 5.27.2

- **Fix Poetiq Community Progress Data Accuracy** (Author: Cascade using Claude Sonnet 4)
  - **Bug #1 - Wrong Puzzle Count**: Page showed 114 puzzles instead of 120 because puzzle loader deduplicates overlapping ARC1/ARC2 IDs
    - **Fix**: Created dedicated `/api/poetiq/community-progress` endpoint that reads ALL 120 puzzle IDs directly from file system
  - **Bug #2 - Incorrect Status**: All puzzles showed as "attempted" because `/api/puzzle/bulk-status` returns most recent explanation regardless of model
    - **Fix**: New endpoint queries only `WHERE model_name LIKE 'poetiq-%'` to get Poetiq-specific explanations
  - **New Repository Method**: Added `getPoetiqExplanationsForPuzzles()` to `ExplanationRepository` for Poetiq-filtered queries
  - **Updated Hook**: `usePoetiqCommunityProgress` now uses dedicated endpoint instead of incorrect bulk-status approach

### Version 5.27.1

- **Poetiq API Key Security Enhancements** (Author: Cascade using Claude Sonnet 4)
  - **HTTPS Enforcement**: Production servers now require HTTPS for API key submissions to prevent plaintext transmission
  - **Key Validation**: Added basic format validation (minimum length, character set) to reject malformed keys before processing
  - **Enhanced User Communication**: Added detailed security explanation box on community page with clear bullet points
  - **Response Safety**: Ensured API keys are never included in any API responses, only provider type
  - **Security Documentation**: Updated UI to explain zero-persistence security model (process isolation, no storage, immediate destruction)

### Version 5.27.0

- **Poetiq Community Solver Page** (Author: Cascade using Claude Sonnet 4)
  - **New Landing Page**: Created `/poetiq` page explaining Poetiq code-generation methodology in plain language
  - **Visual Progress Grid**: Shows all 120 ARC2-eval puzzles with color-coded status (solved/attempted/unattempted)
  - **Community Quick Start**: BYO API key configuration for Gemini Direct or OpenRouter providers
  - **Progress Dashboard**: Real-time stats showing completion percentage and remaining puzzles
  - **Collapsible Explainer**: Detailed comparison of direct prediction vs code generation approaches
  - **Navigation Integration**: Added "Poetiq Solver" link under Misc dropdown in navigation
  - **Enhanced Hook**: `usePoetiqCommunityProgress` fetches all puzzle statuses with filtering capabilities
  - **Reusable Components**: `PoetiqExplainer` and `PuzzleProgressGrid` components for modular design
  - **Community Pooling**: Enables 20 people × 6 puzzles approach to complete full dataset
  - **Model Support**: Multiple OpenRouter models with speed/cost indicators (Gemini 2.5 Pro/Flash, Claude Sonnet 4, GPT-4o)

### Version 5.26.1

- **Fix Poetiq WebSocket Connection** (Author: Cascade using Claude Sonnet 4)
  - **Root Cause**: Poetiq solver was trying to connect to `/ws?sessionId=...` which was rejected by the wsService verifyClient whitelist that only allowed Saturn and Grover paths
  - **Server Fix**: Added `/api/poetiq/progress` to WebSocket whitelist in `server/services/wsService.ts` alongside `/api/saturn/progress` and `/api/grover/progress`
  - **Client Fix**: Updated `client/src/hooks/usePoetiqProgress.ts` to use the correct URL pattern `/api/poetiq/progress?sessionId=...` with proper dev host detection (`localhost:5000` in dev, `location.host` in prod)
  - **Payload Fix**: Fixed message parsing to handle the `{ type, data }` payload structure that wsService broadcasts
  - **Logging**: Added connection lifecycle logging for debugging

### Version 5.26.0

- **ARC2-Eval Progress Tracking & Bug Fixes** (Author: Cascade using Claude Sonnet 4)
  - **ARC2-Eval Progress Dashboard**: Added `useArc2EvalProgress` hook and progress card showing total/attempted/solved puzzles
  - **Bulk Status Endpoint**: Created `POST /api/puzzle/bulk-status` for efficient explanation status lookup across multiple puzzles
  - **Poetiq Filtering**: Progress tracking filters for Poetiq solver results only (models starting with 'poetiq-')
  - **Current Puzzle Status**: Shows whether current ARC2-eval puzzle is solved/attempted with previous model info
  - **Fixed API Parameter**: Changed from `dataset=ARC2-Eval` to `source=ARC2-Eval` for correct puzzle list endpoint
  - **Fixed Response Structure**: Updated hook to handle array directly in response data, not nested under `puzzles`
  - **Fixed TypeScript Error**: Corrected `formatResponse.error()` call to provide required error and message parameters
  - **Fixed DOM Warnings**: Added `autoComplete="new-password"` to API key input and wrapped in form element
  - **Better Error Handling**: Added console logging for debugging ARC2-eval progress issues

### Version 5.25.0

- **Poetiq BYO API Key & Expert Configuration** (Author: Cascade using Claude Sonnet 4)
  - **Bring Your Own Key**: Users can now paste their own Gemini or OpenRouter API key directly in the UI
  - **Key never stored**: API key is passed only to the solver process environment, never logged or persisted
  - **Expert count selector**: Choose 1, 2, 4, or 8 parallel experts (default: 2 = Gemini-3-b config)
  - **Provider selection**: Choose between Gemini Direct or OpenRouter
  - **Default changed to 2 experts**: Updated `poetiq-solver/arc_agi/config.py` to use NUM_EXPERTS=2 by default
  - **Dynamic config**: Python wrapper now builds per-request CONFIG_LIST based on user options
  - **Beautiful UI**: Redesigned PoetiqSolver.tsx with clear BYO key messaging and expert explanations
  - **ARC2-Eval Progress Tracking**: Added `useArc2EvalProgress` hook to show which ARC2-eval puzzles have been solved/attempted
  - **Progress Dashboard**: New ARC2-Eval Progress card shows total/attempted/solved counts, completion percentage, and current puzzle status

### Version 5.24.0

- **Poetiq OpenRouter Support & UI** (Author: Cascade using Claude Sonnet 4)
  - **OpenRouter integration**: Added support for routing Poetiq solver through OpenRouter to avoid Gemini direct API rate limits
  - **Updated Poetiq solver files**: `arc_agi/types.py`, `arc_agi/llm.py`, `arc_agi/config.py` now support OpenRouter model IDs
  - **Environment variable**: Set `USE_OPENROUTER=true` to automatically use OpenRouter
  - **Created PoetiqSolver.tsx UI page**: New page at `/puzzle/poetiq/:taskId` for running the Poetiq solver with model selection
  - **Created usePoetiqProgress hook**: WebSocket-based progress tracking hook
  - **Rate limit mitigation plan**: Created `docs/plans/2025-11-25-poetiq-rate-limit-plan.md`
  - **94 untested puzzles**: From ARC Prize 2025 evaluation set ready to run via OpenRouter

### Version 5.23.0

- **Poetiq ARC-AGI Solver Integration** (Author: Cascade using Claude Sonnet 4)
  - **Added Poetiq solver as git submodule**: Integrated the Poetiq ARC-AGI solver (https://github.com/82deutschmark/poetiq-arc-agi-solver) as a submodule at `poetiq-solver/`. This solver claims SOTA results using iterative code generation with LiteLLM.
  - **Created Python bridge wrapper** (`server/python/poetiq_wrapper.py`): NDJSON-streaming bridge that runs the Poetiq solver via subprocess, emitting progress events for WebSocket broadcasting and capturing iteration data, generated code, and predictions.
  - **Created PoetiqService** (`server/services/poetiq/poetiqService.ts`): TypeScript service wrapping Python execution, transforming Poetiq results to standard explanation format for database storage. Stores Poetiq-specific data (iterations, generated code, config) in `providerRawResponse` JSONB field.
  - **Created PoetiqController** (`server/controllers/poetiqController.ts`): API controller with endpoints:
    - `POST /api/poetiq/solve/:taskId` - Run Poetiq solver on a single puzzle (async with WebSocket progress)
    - `POST /api/poetiq/batch` - Run Poetiq solver on entire dataset (arc1, arc2, arc2-eval, arc-heavy, concept-arc)
    - `GET /api/poetiq/batch/:sessionId` - Get batch progress and results
    - `GET /api/poetiq/status/:sessionId` - Get single solver progress
    - `GET /api/poetiq/models` - List supported Poetiq models (Gemini, GPT-5, Claude, Grok via LiteLLM)
  - **Integration plan document** (`docs/plans/2025-11-25-poetiq-integration-plan.md`): Critical assessment of Poetiq methodology including architecture analysis, concerns for reproducibility, and integration strategy.
  - **Key differences from other solvers**: Poetiq uses iterative code generation (generates Python `transform()` functions) rather than direct grid prediction, with sandboxed execution and voting across parallel experts. Results include generated code and iteration history alongside predictions.

### Version 5.22.11

- Official Scoring Page Dataset Header (Author: Cascade)
  - Clarified and centered the "Learn about the three different datasets" collapsible header on the Official Scoring page so it now reads "Click here to learn about the three different datasets" with a centered layout, making the affordance to expand the explainer more obvious to non-technical readers (`client/src/pages/HuggingFaceUnionAccuracy.tsx:335-348`).

### Version 5.22.10

- Official Scoring Page Dataset Docs (Author: Cascade)
  - Updated the three-dataset explainer on the Official Scoring page to include a direct link to the ARC Prize 2025 evaluation overview on arXiv (HTML view: `https://arxiv.org/html/2412.04604v2`), alongside the existing ARC Prize policy link. This gives readers a primary-source description of how public, semi-private, and private sets are designed and used (`client/src/pages/HuggingFaceUnionAccuracy.tsx:352-405`).

### Version 5.22.9

- Official Scoring Page Default Model Pair (Author: Cascade)
  - Changed the Official Scoring page auto-selection logic to default to the 9th model pair in the list (index 8) when available, matching the intended Claude Opus 4.5 max-thinking configuration as the default example. If fewer than 9 pairs exist, the page now falls back to the first available pair while still auto-calculating results on load (`client/src/pages/HuggingFaceUnionAccuracy.tsx:127-149`).

### Version 5.22.8

- Infrastructure & ingestion safety notes (Author: GPT-5 Codex)
  - Documented storage expansion by +250 GB to unblock PostgreSQL `No space left on device` errors during Hugging Face ingestions (CHANGELOG.md).
  - Clarified ingestion dedupe behavior: default mode skips existing `datasetName-attempt#` explanations per puzzle; enabling “Force Overwrite” deletes the existing attempt rows before re-importing, so reruns won’t double-ingest unless overwrite is explicitly toggled (CHANGELOG.md).

### Version 5.22.7

- Official Scoring Page Automatic Calculation
  - **Auto-calculate results on page load**: Changed Official Scoring page to automatically fetch and display results when the page loads, eliminating the need for users to manually click the "Calculate" button. The default model selection has been changed from the 9th pair to the 4th pair in the model list. When both the dataset and model selections are ready, the calculation triggers automatically via a new `useEffect` hook (`client/src/pages/HuggingFaceUnionAccuracy.tsx:143-149, 214-219`).
  - **Updated default model selection logic**: Changed the auto-selection from the 9th model pair to the 4th model pair (index 3). If fewer than 4 pairs are available, it defaults to the first pair as a fallback (`client/src/pages/HuggingFaceUnionAccuracy.tsx:143-149`).

### Version 5.22.6

- Official Scoring Page Polish & Readability
  - **Fixed JSX syntax error in TL;DR code block**: Escaped braces in the API message format (`messages=[{'{role: "user", content: prompt}'}]`) in step 4 of the developer TL;DR section to prevent TypeScript compilation errors about undefined `role` variable. The braces are now properly rendered as literal text (`client/src/pages/HuggingFaceUnionAccuracy.tsx:720`).
  - **Increased all text sizes by two font levels for readability**: Systematically increased font sizes throughout the Official Scoring page by two Tailwind size steps for better readability on all device sizes. Changes: `text-xs` → `text-sm`, `text-sm` → `text-base`, `text-base` → `text-lg`, `text-lg` → `text-xl`, `text-2xl` → `text-3xl`, `text-3xl` → `text-4xl`, and `text-[11px]` → `text-xs`. Affects all body text, labels, alerts, metrics, and explanatory content across the page (`client/src/pages/HuggingFaceUnionAccuracy.tsx`).
  - **Added anchor link from user message explanation to provider system prompts**: Added a quick inline link ("view provider system prompts") in point 1 "The User Message (No Explicit System Prompt)" that scrolls users directly to the "Provider system prompts (developer note)" section at the bottom of the page. This improves navigation for users who want to understand what default system prompts various providers apply when no custom system prompt is sent (`client/src/pages/HuggingFaceUnionAccuracy.tsx:593-597, 759`).

### Version 5.22.5

- Official Scoring Page – Provider System Prompts
  - **Linked canonical provider system prompts for context**: Added a concise developer-note section at the bottom of the HuggingFace Union accuracy page explaining that default system prompts for major providers (Gemini, OpenAI, Anthropic, Grok) are publicly documented in the CL4R1T4S repository, with a direct link to `https://github.com/elder-plinius/CL4R1T4S/tree/main`. Clarifies that these are provider defaults that may apply when no custom system prompt is sent, and that Grok explicitly states system messages take precedence over user messages, with unknown impact on ARC harness testing (`client/src/pages/HuggingFaceUnionAccuracy.tsx`).
  - **Added inline “Fetch latest provider system prompts” tool**: Introduced a small developer-oriented button in the same footer section that, when clicked, fetches the latest system prompt text for Gemini 2.5 Pro, Claude Sonnet 4.5, OpenAI ChatGPT5, and Grok 4.1 directly from their CL4R1T4S raw GitHub URLs. The UI shows a compact preview (truncated text) for each provider plus a “View on GitHub” link back to the source file, with basic loading/error handling. This keeps the main educational content unchanged while giving advanced users a fast way to inspect the exact default system instructions those providers document (`client/src/pages/HuggingFaceUnionAccuracy.tsx`).
  - **Full prompt display**: Removed truncation so the fetched system prompt panels now show the entire text (scrollable) instead of the first 1200 characters, making the fetched data genuinely useful for deep review (`client/src/pages/HuggingFaceUnionAccuracy.tsx`).
  - **Automatic loading**: The provider system prompts now load automatically on page visit, with a lightweight "loading" state and error message if retrieval fails. No manual button click required (`client/src/pages/HuggingFaceUnionAccuracy.tsx`).

### Version 5.22.4

- Official Scoring Page Educational Enhancement
  - **Added visual grid representation in harness explanation**: Enhanced the "Training Examples" section (step 2) of "How the Official Testing Harness Works" with side-by-side comparison showing what humans see (colored 3×3 grid rendered with TinyGrid component) vs what the model sees (plain JSON array text). This visual contrast directly addresses the critical misconception that models perceive the puzzles visually. Added accompanying explanatory text: "While humans interpret this colored grid intuitively, the model sees only plain text—numbers in brackets. The model has no visual understanding of colors. It treats 0, 1, 2, etc. as abstract symbols." This clarifies that despite ARC Explainer visualizing puzzles as colored grids for human comprehension, the official harness sends only JSON text to the model (`client/src/pages/HuggingFaceUnionAccuracy.tsx:561-610`, imported TinyGrid component at line 26).
  - **Emphasized minimal context given to model**: Added detailed breakdown under "What information does the model actually receive?" highlighting that: (1) system prompt tells it there's a pattern to find, (2) it sees training input/output pairs as JSON arrays, (3) it sees test input without answer, and (4) that's it—no information about colors, hints about geometry, or explanation of what numbers represent. This underscores how the harness is intentionally minimalist and the model must solve the puzzle using only mathematical/logical pattern recognition (`client/src/pages/HuggingFaceUnionAccuracy.tsx:588-596`).
  - **Added Developer TL;DR section**: New expandable subsection in harness explanation summarizing the complete evaluation flow in 7 numbered steps for developers: (1) Build prompt, (2) Convert to text via json.dumps(), (3) Embed in template, (4) **One API call**, (5) Get response, (6) Extract JSON answer, (7) Compare to ground truth. Includes explicit "NOT" list: Multiple API calls ❌, Images/binary ❌, Streaming puzzles ❌, Multi-turn ❌. This directly answers the three core implementation questions the user investigated (`client/src/pages/HuggingFaceUnionAccuracy.tsx:656-672`).
  - **Fixed "Why this matters" explanation**: Restored complete text explaining why LLMs solving abstract patterns with only text representations is remarkable, then added proper Discord server link with styling to invite discussion. Changed from incomplete/misleading text to: "The fact that an LLM can solve these abstract pattern-matching tasks using only text representations (without ever seeing colors or shapes) is remarkable. It suggests the model has learned to recognize mathematical and logical patterns purely from the structure of numbers. This is the sort of thing we discuss in our Discord server. Please come visit us at [Discord server link]." (`client/src/pages/HuggingFaceUnionAccuracy.tsx:598-609`).

### Version 5.22.3


- Official Scoring Page Accuracy Improvements
  - **Corrected testing harness explanation to reflect actual implementation**: Fixed inaccuracies in "How the Official Testing Harness Works" section. Updated step 1 to quote the exact system prompt wording from `system_prompt.txt` (verified against actual source file). Updated step 2 to clarify that grids are sent as **raw JSON arrays** with integer values—removed inference about "0-9 representing colors" since this is not stated in the actual harness code/prompts (that's external domain knowledge about ARC-AGI tasks, not documented in the evaluation harness itself). Improved accuracy by referencing actual `prompt_manager.py` implementation showing `json.dumps()` formatting, making clear that the model receives arrays like `[[0, 1, 2], [3, 4, 5], [6, 7, 8]]`, not visual/rendered colored squares. This prevents misconception that the harness sends visual content (`client/src/pages/HuggingFaceUnionAccuracy.tsx:547-560`).
  - **Added comprehensive authorship attribution, data leakage note, and error reporting link**: Added author note clearly crediting Claude Sonnet 4.5 for all text, research, source code analysis, and refinement through iterative feedback. Emphasizes that the author researched the actual Arc-AGI-Benchmarking source code, read system prompts, and analyzed the implementation directly. Notes that several corrections were made along the way to ensure accuracy. **Added critical transparency note about data leakage**: Explicitly documents that the AI learned the color mappings for ARC integers (0=black, 1=blue, 2=red, etc.) from public training data, NOT from the evaluation harness code (which is completely agnostic to integer meaning). This note serves as a concrete example illustrating why semi-private and fully-private evaluation sets exist and must remain secret—to prevent exactly this kind of information leakage into future AI training data. Added canonical Discord server link (https://discord.gg/9b77dPAmcA) for users to report any errors or missing information, encouraging community-driven quality assurance (`client/src/pages/HuggingFaceUnionAccuracy.tsx:610-629`).
  - **Changed default model selection to Claude Sonnet 4.5 with maximum thinking**: Updated auto-selection logic to default to the 9th model pair (Claude Sonnet 4.5 with maximum thinking enabled, changed from 21st). Updated empty state message to explicitly credit Claude Sonnet 4.5 as the page author and explain that this model's results are shown by default, allowing users to see the author's specific capability on the ARC Prize public evaluation set. Falls back to first available option if fewer than 9 pairs are available (`client/src/pages/HuggingFaceUnionAccuracy.tsx:121-127, 515`).
  - **Cleaned up unused imports and interfaces**: Removed unused CardHeader, CardTitle, and CardDescription imports from shadcn/ui Card component. Removed unused AttemptPairOption interface that was declared but never used (`client/src/pages/HuggingFaceUnionAccuracy.tsx:14, 42-47`).
  - **Made three-tier evaluation set explainer collapsible by default**: Converted "Learn about the three different datasets" section from always-expanded to collapsed-by-default with expand/collapse toggle. Updated heading to clarify that the section explains the three datasets (public, semi-private, private) rather than calling them "types." Users can now click the header with chevron icon to reveal the dataset details, reducing initial page clutter. Added state management for section visibility (`client/src/pages/HuggingFaceUnionAccuracy.tsx:65, 272-345`).
  - **Corrected score difference explanation**: Fixed misleading explanation that claimed "scores here are higher." Replaced with accurate description emphasizing that public and semi-private sets contain **completely different puzzles**, resulting in different scores that can go either direction. Updated to focus on the fundamental fact: "Different datasets = Different puzzles = Different results." Clarified that scores between these datasets cannot be directly compared because they're separate evaluations (`client/src/pages/HuggingFaceUnionAccuracy.tsx:335-342`).
  - **Moved puzzle ID badges inline with score percentage**: Restructured score card layout so solved puzzle badges now appear on the same horizontal line as the large percentage display and lightning bolt icon. Removed duplicate puzzle badges section and consolidated into single display in the top-right of the score card. This improves visual hierarchy and makes puzzle inspection more discoverable (`client/src/pages/HuggingFaceUnionAccuracy.tsx:425-449`).
  - **Removed pattern/clue terminology from harness explanation**: Updated "How the Official Testing Harness Works" section to remove misleading references to "patterns" and "clues." Changed step 2 title from "Training Examples (Your Pattern Clues)" to simply "Training Examples" and updated descriptions to say inputs "map to outputs" rather than describing what "the pattern produces." Updated step 3 to remove "figure out the pattern" and kept focus on the actual task: looking at training examples and predicting the output. This maintains technical accuracy without imposing interpretive language (`client/src/pages/HuggingFaceUnionAccuracy.tsx:548, 554, 558, 563, 566`).

### Version 5.22.2

- Official Scoring Page UI Refinements
  - **Repositioned puzzle ID badges higher in score card**: Moved puzzle ID badges section from bottom of result card to appear immediately after "X of Y puzzles solved" progress line, making puzzle exploration more prominent and visible without scrolling. This improves information hierarchy by placing the most actionable results (which puzzles were solved) before less important metadata (model names). Removed border-top separator and added border-top to model names section instead (`client/src/pages/HuggingFaceUnionAccuracy.tsx:454-481`).
  - **Made testing harness explanation always visible and repositioned to bottom**: Moved "How the Official Testing Harness Works" expandable card section outside of the results conditional block and positioned it at the bottom of the page after the results/empty state. Results now display directly under the controls section as expected. The harness explanation is always accessible at the bottom while remaining fully collapsed/expandable for users who want to learn more about the evaluation methodology (`client/src/pages/HuggingFaceUnionAccuracy.tsx:428-519`).
  - **Enhanced disclaimer with links and leaderboard comparison**: Expanded the important disclaimer alert to prominently explain that public evaluation set results differ from the official ARC Prize leaderboard (which uses semi-private evaluation set). Added direct links to: Hugging Face dataset, official ARC Prize leaderboard, and ARC Prize website. Clarifies that different datasets contain different puzzles, resulting in different scores (`client/src/pages/HuggingFaceUnionAccuracy.tsx:210-255`).
  - **Added three-tier evaluation structure explainer (5th-grade reading level)**: New card section with simplified explanation of ARC's three-tier evaluation sets, written at 5th-grade reading level with concrete examples (comparing to practice test vs. surprise test). (1) Public set—everyone can see, shared on GitHub/Hugging Face, AI companies can study; (2) Semi-Private set—ARC keeps secret for fair leaderboard ranking; (3) Private set—super secret for competition. Added prominent link to official ARC Prize policy and disclaimer that this is a friendly, unofficial explanation. Clarifies why public scores are higher: models haven't seen the secret puzzles (`client/src/pages/HuggingFaceUnionAccuracy.tsx:277-340`).
  - **Renamed route from `/hf-union-accuracy` to `/scoring`**: Changed endpoint URL for cleaner, more intuitive naming. Updated in App.tsx route definition, AppNavigation navigation link, and canonical path metadata (`client/src/App.tsx:75`, `client/src/components/layout/AppNavigation.tsx:85`, `client/src/pages/HuggingFaceUnionAccuracy.tsx:62`).
  - **Clarified AI companies in public set explanation**: Updated language in public evaluation set description to explicitly mention major AI companies (OpenAI, Google, Anthropic, Grok, etc.) that can study the public puzzles, making the explanation more concrete and understandable (`client/src/pages/HuggingFaceUnionAccuracy.tsx:277-340`).
  - **Changed default model selection to 21st pair**: Updated auto-selection logic to default to the 21st model pair in the attempt pair options list when available. Falls back to first available option if fewer than 21 pairs are available (`client/src/pages/HuggingFaceUnionAccuracy.tsx:121-127`).

### Version 5.22.1

- Official Scoring Page Polish
  - **Fixed Radix UI SelectItem validation error**: SelectItem with empty string value (`value=""`) was throwing Radix UI validation error. Changed to non-empty value (`value="no-models"`) to comply with Radix UI requirement that SelectItem values cannot be empty strings. This prevented Official Scoring page from rendering (`client/src/pages/HuggingFaceUnionAccuracy.tsx:276`).
  - **Consolidated puzzle badges into score card**: Moved puzzle ID badges from separate bottom card into the main score card component, utilizing the wasted whitespace between the score percentage and lightning bolt icon. Added border-top separator and kept the "✓ Solved X puzzles" label for clarity. This improves information hierarchy and creates a unified, focused card layout (`client/src/pages/HuggingFaceUnionAccuracy.tsx:369-387`).
  - **Made testing harness explanation expanded by default**: Changed `showHarnessDetails` initial state from `false` to `true` so that "How the Official Testing Harness Works" section is expanded on page load. Makes the educational content immediately visible to users without requiring them to click to expand (`client/src/pages/HuggingFaceUnionAccuracy.tsx:71`).
  - **Set fifth model pair as default**: Enhanced auto-selection logic to default to the fifth model pair in the attempt pair options list when available. Falls back to first available option if fewer than five pairs are available (`client/src/pages/HuggingFaceUnionAccuracy.tsx:121-127`).

### Version 5.22.0

- Analytics
  - **New Official Scoring Page (Public Evaluation)**: Created dedicated `/hf-union-accuracy` page visualizing official ARC Prize team evaluation results on the public evaluation set. The page prominently clarifies that these are **official results from the ARC Prize team's evaluation harness**, posted on Hugging Face—not personal or custom evaluations. ARC Explainer is a visualization tool that makes the raw JSON data published on Hugging Face more human-readable, searchable, and visual. Explains the official scoring method: models are tested twice per puzzle independently, and a puzzle counts as solved if **either attempt produces the correct answer**. This shows each model's best-case performance when given multiple chances.
    - **Clear Attribution**: Prominent amber disclaimer with prominent link to Hugging Face stating that results are official from the ARC Prize team (posted on Hugging Face), explaining ARC Explainer is a visualization tool for that raw data, with all credits and ownership belonging to the ARC Prize team
    - **Plain Language Explanation**: Describes the official evaluation harness methodology in student-friendly terms with visible formula: `Best-Case Score = (Puzzles correct in attempt 1 or attempt 2) ÷ Total puzzles`
    - **Important Dataset Note**: Clearly states results are from the **public** evaluation set (different from semi-private set on official ARC Prize website), explaining why scores differ from official leaderboard
    - **Interactive Results**: Select dataset + model pair, view score with progress bar, inspect individual puzzle IDs via clickable badges
    - **Compact Design**: Maximum information density (minimal padding, p-2/p-3 spacing, text-xs fonts) matching Analytics/Comparison page patterns
    - **Reusable Logic**: Composes existing union accuracy utilities (`computeAttemptUnionAccuracy()`, `parseAttemptModelName()`, `/api/metrics/compare`) with zero duplication
    - **Auto-Filtering**: Automatically filters to official HF submissions (model names ending with `-attempt1`/`-attempt2`)
    - **Navigation**: Added "Official Scoring" link in main header with Zap icon (`client/src/pages/HuggingFaceUnionAccuracy.tsx`, `client/src/App.tsx:28,75`, `client/src/components/layout/AppNavigation.tsx:82-88`).

### Version 5.21.1

- Model Comparison
  - **Enhanced Union Accuracy transparency with interactive puzzle exploration**: Added explicit puzzle ID display showing exactly which puzzles contribute to union accuracy calculation. New `unionPuzzleIds` computed value extracts all puzzle IDs solved correctly in either attempt and displays them as interactive `ClickablePuzzleBadge` components (shadcn/ui Badge with success variant) that open Puzzle Examiner in new tab on click. Shows `Puzzles solved (N) — click to explore` section with full list of contributing puzzle IDs. Users can now directly inspect any puzzle that contributed to the union accuracy score, providing complete calculation transparency with actionable exploration (`client/src/pages/ModelComparisonPage.tsx:16,361-384,608-626`).
  - **Overhauled ModelComparisonPage UI/UX for clarity**: Restructured entire page layout with clear section headers and explanatory subtitles for each section: "Comparing Models" (with improved model badge styling and "Active (2/4)" counter), "Differentiation" (puzzles solved by exactly one model), "Attempt Union Accuracy" (union metrics with blue left border accent), "Performance Comparison" (detailed metrics table), "Puzzle-by-Puzzle Breakdown" (matrix view), and "Individual Model Deep Dive" (drilldown panels). Added helpful instructions for each section. Reduced page padding (p-3→p-2, space-y-3→space-y-2) for data density. Improved Active Models control UI with separated "Active" and "Add Another" sections, better visual model badges with hover effects, and clearer conditional rendering (`client/src/pages/ModelComparisonPage.tsx:464-717`).
  - **Redesigned Attempt Union Accuracy UI**: Replaced basic blue box display with comprehensive `AttemptUnionCard` component featuring ShadCN/UI Card patterns, visual progress bar, and detailed explanation section. Added plain-language description of union accuracy metric and mathematical formula showing how it's calculated (puzzles correct by any attempt ÷ total puzzles) for full research transparency. Improved visual hierarchy with prominent metric percentage, model badges, and accessibility labels (`client/src/components/analytics/ModelComparisonDialog.tsx`).


- Model Comparison
  - **Implemented attempt union accuracy metrics**: Added comprehensive support for computing union-of-correct accuracy across attempt1/attempt2 model pairs (e.g., "gemini-3-deep-think-preview-attempt1" + "gemini-3-deep-think-preview-attempt2"). Features include:
    - Frontend utilities: `computeAttemptUnionAccuracy()` and `parseAttemptModelName()` in `client/src/utils/modelComparison.ts` for deriving union metrics from existing comparison details
    - Backend extension: New `AttemptUnionStats` interface and `computeAttemptUnionStats()` method in `MetricsRepository.ts` that parses model names, groups attempts by base model, and computes union correctness by iterating through puzzle results
    - UI integration: Union metrics display blocks in both `ModelComparisonPage.tsx` and `ModelComparisonDialog.tsx` showing base model name, attempt models, union correct count, total puzzles, and union accuracy percentage with blue styling
    - Graceful fallback: Frontend components prefer backend-provided `attemptUnionStats[0]` when available, with frontend computation as fallback for backward compatibility
    - Type safety: Extended `ModelComparisonSummary` interfaces on both client and server to include `attemptUnionStats: AttemptUnionStats[]` array
    - Edge case handling: Supports models in any position (model1-4), validates attempt numbers, and handles missing attempts gracefully. (Author: Cascade)

### Version 5.20.3

- Bug Fixes
  - **Fixed TypeScript type mismatch in BulkExplanationStatusLight**: The lightweight explanation status query was being read by `puzzleService.getPuzzleList()` and `puzzleOverviewService.buildPuzzleMap()` which expected `apiProcessingTimeMs`, but the type definition omitted this field. Added `apiProcessingTimeMs: number | null` to `BulkExplanationStatusLight` interface, added it to the initialization defaults, included `e.api_processing_time_ms` in the SQL SELECT clause, and mapped it to the status object. This resolves strict TypeScript mode compilation errors and preserves processing-time data for service-layer enrichment. Single numeric field has negligible impact on the 99% data transfer reduction (which omits large JSONB fields like saturnImages and providerRawResponse) (`server/repositories/interfaces/IExplanationRepository.ts:173-190`, `server/repositories/ExplanationRepository.ts:608,640,664`).

### Version 5.20.2

- Documentation
  - Added `docs/2025-11-23-model-comparison-union-attempts-plan.md` outlining a two-phase implementation to compute union-of-correct accuracy across attempt1/attempt2 model pairs on ARC datasets. Plan covers a frontend utility for deriving union metrics from existing comparison details plus a backend `MetricsRepository` summary extension to expose canonical attempt union stats for reuse across analytics views. (Author: Cascade)

### Version 5.20.1

- ELO Arena
  - Added a "Review 10 featured puzzles" entrypoint to the Compare Explanations page, exposing the curated featured set (Mike/TEAM tweet-aligned IDs) directly in the ELO arena header. New `FeaturedPuzzlesEloEntry` component uses the shared `shared/featuredPuzzles.ts` source-of-truth and provides quick links to `/elo/:taskId` for each featured puzzle (`client/src/components/elo/FeaturedPuzzlesEloEntry.tsx`, `client/src/pages/EloComparison.tsx`).

### Version 5.20.0

- Shared
  - Minimal reusable source-of-truth for the ten featured puzzles: added `shared/featuredPuzzles.ts` exporting `FEATURED_PUZZLE_IDS`, `FEATURED_PUZZLE_NOTES`, `FEATURED_PUZZLES`, and `getFeaturedPuzzles()`. Not wired into any page yet; intended for future imports by PuzzleBrowser and others. IDs: `65b59efc`, `e3721c99`, `dd6b8c4b`, `2ba387bc`, `14754a24`, `b457fec5`, `891232d6`, `7b5033c1`, `981571dc`, `136b0064`.

### Version 5.19.0

- Database Performance & Architecture
  - **PHASE 1: Lightweight bulk explanation status query**: Created `getBulkExplanationStatusLight()` that returns only 8 fields actually used by puzzle list UI instead of 37 heavy fields. This reduces data transfer by 99% (1.2GB → 15KB for 1600+ puzzles) and eliminates PostgreSQL temp file bloat on Railway's limited disk space. Updated `puzzleService.ts` and `puzzleOverviewService.ts` to use the lightweight method. Fixes "No space left on device" errors (`server/repositories/ExplanationRepository.ts:576-671`, `server/repositories/interfaces/IExplanationRepository.ts:173-184`, `server/services/puzzleService.ts:84`, `server/services/puzzleOverviewService.ts:190,309`).
  - **PHASE 2: Move analytics out of ExplanationRepository**: Moved `getWorstPerformingPuzzles()` from ExplanationRepository to MetricsRepository (SRP fix). This method does cross-table analytics (explanations + feedback) and computes composite scores, which is analytics work that belongs in MetricsRepository, not a CRUD repository. Updated all callers in `puzzleOverviewService.ts` to use `repositoryService.metrics.getWorstPerformingPuzzles()` (`server/repositories/MetricsRepository.ts:1252-1451`, `server/services/puzzleOverviewService.ts:190,309`).
  - **Aggressive database cleanup on startup**: Modified database maintenance to terminate ALL active/idle queries on startup (not just long-running idle transactions) to force cleanup of orphaned PostgreSQL temp files. Runs automatically every 6 hours to prevent temp file accumulation on Railway (`server/maintenance/dbCleanup.ts:81-110`).

### Version 5.18.6

- Puzzle Browser
  - **Simplified featured puzzle loading**: Removed the over-engineered 10-hook `useQuery` system and reverted to a single `usePuzzleList({})` call for the featured gallery, then deriving the curated set purely in memory from `FEATURED_PUZZLE_IDS`. This guarantees all 10 desired IDs show up when present in the global list while keeping network traffic and state minimal (`client/src/pages/PuzzleBrowser.tsx:123-135`).
  - **Header layout + community links**: Removed the CollapsibleMission header component entirely and inlined three community pills (Discord Community, ML Street Talk, and **ARC Discord Weekly Meeting** linking to `https://www.twitch.tv/professormaxhammer`) directly into the PuzzleBrowser header, aligned horizontally beside the EmojiMosaicAccent banner (`client/src/pages/PuzzleBrowser.tsx:256-299`).

### Version 5.18.5

- Puzzle Browser - **FIXED Critical Featured Puzzles Bug**
  - **FIXED**: Landing page now correctly displays all 10 featured puzzles (`65b59efc`, `e3721c99`, `dd6b8c4b`, `2ba387bc`, `14754a24`, `b457fec5`, `891232d6`, `7b5033c1`, `981571dc`, `136b0064`).
  - **What was broken**: Previous commits hallucinated a non-existent `POST /api/puzzle/list` endpoint that accepts `puzzleIds` in request body. This endpoint doesn't exist in the API (see `docs/reference/api/EXTERNAL_API.md` lines 57-60).
  - **The fix**: Replaced hallucinated endpoint with 10 individual `useQuery` calls using the correct `GET /api/puzzle/task/:taskId` endpoint. Each query explicitly fetches one puzzle with proper `queryFn` implementation (`client/src/pages/PuzzleBrowser.tsx:123-171`).
  - **Technical details**:
    - 10 individual hooks: `featured0` through `featured9`
    - Each uses `fetch('/api/puzzle/task/:taskId')` with error handling
    - Proper loading state: `featuredQueries.some(q => q.isLoading)`

### Version 5.18.4

- Puzzle Browser - Critical Presentation Fix
  - **FIXED featured puzzle loading for presentation**: The 5.18.3 implementation was creating stub/fake puzzles when featured puzzles weren't found in filtered results. Now properly fetches all 10 featured puzzles directly by ID using individual `useQuery` calls to `/api/puzzle/task/:taskId` endpoint, guaranteeing they display reliably regardless of filter state. Removed stub puzzle creation logic entirely (`client/src/pages/PuzzleBrowser.tsx:123-144`).
  - **Fixed React hooks violation**: Changed from calling `useQuery` in a loop to 10 individual hook declarations (`featured0` through `featured9`) to comply with React rules of hooks.
  - **Added dedicated loading state**: New `isFeaturedLoading` state tracks when featured puzzles are loading, independent of the advanced browser's filter results.

### Version 5.18.3

- Puzzle Browser - Critical Presentation Fixes
  - **Fixed header alignment**: Changed header layout from `justify-between` to centered flex column so the CollapsibleMission component (mission button + Discord/YouTube links) and EmojiMosaicAccent are properly aligned and centered for cleaner presentation layout (`client/src/pages/PuzzleBrowser.tsx:251`).
  - **Decoupled featured gallery from backend filters**: Stopped relying on the heavy `/api/puzzle/list` results (and `multiTestFilter`) for the featured carousel and instead fetch each tweet-aligned puzzle directly via `/api/puzzle/task/:id`. This keeps the 10 highlighted IDs (`65b59efc`, `e3721c99`, `dd6b8c4b`, `2ba387bc`, `14754a24`, `b457fec5`, `891232d6`, `7b5033c1`, `981571dc`, `136b0064`) visible regardless of advanced filter state, without fabricating stub puzzles (`client/src/pages/PuzzleBrowser.tsx:123-139`).
  - **Team attribution update**: Renamed `MIKE_NOTES` to `TEAM_NOTES` and updated all puzzle annotations to credit "the team" instead of individual attribution. Changed note header from "Team note" to "Team Notes" for consistency (`client/src/pages/PuzzleBrowser.tsx:65-86, 313-320, 535`).

### Version 5.18.1

- Puzzle Examiner
  - **Multi-test mismatch overlay now only marks model outputs**: Updated the multi-test grid rendering in `AnalysisResultGrid` so the "Show Mismatches" toggle applies the high-contrast diff mask only to the model’s predicted grids, never to the expected answer grids. This brings multi-test behavior in line with the single-test card, where the bullseye markers appear exclusively on the AI output for easier visual debugging (`client/src/components/puzzle/AnalysisResultGrid.tsx`).

### Version 5.18.0

- Hall of Fame / Human Trading Cards
  - **More prominent, clearly clickable portraits**: Enlarged contributor portraits on `HumanTradingCard` and added a subtle hover hint plus stronger cursor/hover styling so it’s visually obvious that the images can be clicked to open a zoomed-in view, without changing the existing dialog/profile routing (`client/src/components/human/HumanTradingCard.tsx`).

### Version 5.17.9

- Puzzle Browser
  - **Tweet-aligned featured gallery + Mike annotations**: Expanded the Puzzle Browser featured gallery to include every puzzle ID explicitly mentioned in Mike Knoop's ARC v2/v1 tweet (`65b59efc`, `e3721c99`, `dd6b8c4b`, `2ba387bc`, `14754a24`, `b457fec5`, `891232d6`, `7b5033c1`, `981571dc`) plus `136b0064`, and added a short "Mike note" under each featured card summarizing why that task is interesting for complexity/efficiency analysis. Also embedded his four open research questions about complexity scaling, time-on-task, search coverage, and unsolved v2 tasks into the advanced view "Working notes" section so the browser doubles as a lightweight reading list for ARC reasoning research (`client/src/pages/PuzzleBrowser.tsx`).

### Version 5.17.8

- Puzzle Browser
  - **Curated featured gallery + gated research view**: Updated `PuzzleBrowser` so the default experience shows a small curated gallery of four visually interesting puzzles (`14754a24`, `b457fec5`, `891232d6`, `136b0064`) using the new professional `PuzzleCard` layout, while the full heavy filter/search browser (with hundreds of cards and rich metrics) is now behind an explicit "Open full research browser" toggle. This keeps the new card design but prevents the landing page from trying to render thousands of cards at once (`client/src/pages/PuzzleBrowser.tsx`).

### Version 5.17.7

- Data
  - **Jack Cole Hall of Fame imagery update**: Added multiple profile images (`/jackcole.jpeg`, `/jackCole2.png`) to both Jack Cole contributor entries so Human Trading Cards can rotate between his assets without manual database edits (`server/scripts/seedContributors.ts`).

### Version 5.17.6

- Data
  - **Separated JF Puget 2024 vs 2025 achievements in Hall of Fame seed data**: Cleaned up the Jean-François Puget `competition_winner` entry so it is a 2025-only card for the preliminary ARC Prize 2025 Kaggle leaderboard, leaving the 2024 runner-up paper recognized solely by his dedicated `paper_award` card. This avoids mixing paper-award and competition contexts in a single entry (`server/scripts/seedContributors.ts`).

### Version 5.17.5

- Hall of Fame
  - **2025 Leaderboard now respects year ranges**: Updated `HumanTradingCards` leaderboard logic so contributors whose active range spans 2025 (e.g., yearStart 2024, yearEnd 2025) are included in the "2025 Leaderboard" section instead of being omitted. This ensures Jean-François Puget appears in the 2025 row alongside other preliminary ARC Prize 2025 leaders while still retaining his 2024 entries (`client/src/pages/HumanTradingCards.tsx`).

### Version 5.17.4

- Bug Fixes
  - **PuzzleCard & PuzzleDBViewer TypeScript alignment**: Extended `PuzzleCardProps.performanceData` to include the full set of rich metrics returned by the worst-performing puzzles API (confidence, feedback, composite score, token/cost fields, etc.) and added `formatNumber` / `formatTime` helpers to `PuzzleDBViewer` so unsolved puzzle metrics render correctly without TS build errors (`client/src/components/puzzle/PuzzleCard.tsx`, `client/src/pages/PuzzleDBViewer.tsx`).

- Models
  - **Gemini 3 Pro Preview streaming disabled for reasoning safety**: Changed `supportsStreaming` from `true` to `false` for `google/gemini-3-pro-preview` so the app no longer attempts streaming calls that can truncate reasoning tokens in multi-turn tool-calling scenarios, keeping behavior consistent with the existing `supportsStructuredOutput: false` safeguard (`server/config/models.ts`).

- Data
  - **Jean-François Puget Hall of Fame imagery update**: Updated contributor seed data to support a second profile image for JF Puget so Human Trading Cards can rotate between multiple assets without manual database edits (`server/scripts/seedContributors.ts`).

### Version 5.17.3

- Unsolved Puzzle Viewer
  - **Always load ALL unsolved evaluation puzzles**: Increased the `GET /api/puzzle/worst-performing` limit cap from 50 to 500 so `PuzzleDBViewer` can request the full ARC2-Eval (≈120) and ARC1-Eval (≈400) zero-accuracy sets in one shot (`server/controllers/puzzleController.ts:getWorstPerformingPuzzles`).
  - **Removed infinite cache on worst-performing hook**: Dropped `staleTime: Infinity` from `useWorstPerformingPuzzles` so each visit to the Unsolved ARC Evaluation Puzzles page triggers a fresh worst-performing calculation while still disabling noisy refetch-on-focus/interval (`client/src/hooks/usePuzzle.ts`).

### Version 5.17.2

- UI/UX - Model Selection Density Overhaul
  - **Fixed "ping-pong effect" and wasted space**: Constrained Model Selection container width with `max-w-4xl mx-auto` to eliminate excessive horizontal stretching that forced users' eyes to travel across the full viewport (`client/src/pages/PuzzleExaminer.tsx:405`).
  - **Removed filter UI completely**: Eliminated Premium, Fast, and Reasoning filter toggles per user feedback - this is a research platform, not an e-commerce site (`client/src/components/puzzle/ModelSelectionControls.tsx`, `client/src/components/puzzle/ModelSelection.tsx`).
  - **Professional research platform density**: Systematically tightened spacing throughout the model selection hierarchy:
    - Reduced provider header padding from `p-4` to `p-3`, icon size from `text-2xl` to `text-xl`, title from `text-lg` to `text-base`
    - Reduced vertical spacing: `space-y-3` → `space-y-2`, `space-y-6` → `space-y-3`, `mt-3` → `mt-2`
    - Tightened model grid gaps from `gap-2` to `gap-1.5` and family dividers from `gap-3` to `gap-2`
    - All changes focused on eliminating the "empty ribbon" effect and improving information density

- Models
  - **Added Google Gemini 3 Pro Preview via OpenRouter**: Integrated the newest Gemini model (released Nov 18, 2025) with 1,048,576 token context window and tiered pricing structure ($2-$4/M input tokens, $12-$18/M output tokens based on context length ≤200K vs >200K).
    - **Model Configuration** (`server/config/models.ts:812-830`)
      - Key: `google/gemini-3-pro-preview`, premium tier, reasoning-capable
      - **Critical fields**: `supportsStructuredOutput: false` (prevents JSON mode conflicts with reasoning), `supportsStreaming: true`
      - Special note about preserving `reasoning_details` in multi-turn tool calling per OpenRouter docs
    - **UI Organization** (`shared/modelGroups.ts:227-235`)
      - Created dedicated "Google Gemini" family within OpenRouter provider group (id: `or-gemini`)
      - Reorganized existing `google/gemini-2.5-flash-preview-09-2025` from `or-other` into new `or-gemini` family

- Infrastructure Fixes (Critical for Reasoning Models)
  - **OpenRouter Service: Reasoning Token Extraction** (`server/services/openrouter.ts:300-330`)
    - **Fixed missing reasoning token metrics**: Now extracts `usage.output_tokens_details.reasoning_tokens` from API responses (was previously discarded)
    - Accumulates reasoning tokens across continuation calls for truncated responses
    - Logs reasoning token usage for accurate cost tracking and analytics
  - **OpenRouter Service: Multi-Turn Reasoning Preservation** (`server/services/openrouter.ts:322-330`)
    - **Added `reasoning_details` extraction**: Captures structured reasoning blocks required for multi-turn tool calling conversations
    - Preserves reasoning continuity across tool use and conversation turns (per OpenRouter documentation requirement)
    - Enables proper context maintenance for Gemini 3 Pro and other reasoning models
  - **OpenRouter Service: Token Usage Pipeline** (`server/services/openrouter.ts:75-80, 348-354, 540-561`)
    - Added `usage` parameter throughout API call → parser → response pipeline
    - Returns actual API usage data (input/output/reasoning tokens) instead of estimates
    - Fixes token tracking accuracy for all OpenRouter models

- Bug Fixes
  - **Reasoning models + JSON mode conflict**: Setting `supportsStructuredOutput: false` prevents schema enforcement from truncating reasoning tokens (matches Qwen thinking model pattern at line 430)

### Version 5.17.1

- Data
  - Extended Jean-François Puget Hall of Fame contributor entry to mention his ARC Prize 2024 runner-up paper award for "A 2D nGPT Model For ARC Prize" and added Kaggle discussion + PDF links in the contributors seed script (`server/scripts/seedContributors.ts`).
  - Added a separate 2024 paper-award contributor card for Jean-François Puget so his 2D nGPT ARC Prize paper appears in the Research & Awards section.

### Version 5.17.0

- UI/UX Major Redesign - Professional Research Platform Transformation
  - **PuzzleCard complete redesign**: Transformed from "purple cartoon nightmare" to professional, information-dense scientific research platform (`client/src/components/puzzle/PuzzleCard.tsx`)
    - **Removed**: 5 rainbow gradients, 4 emojis (❌🔥✅💰), 36px border radius, heavy animations, 28px padding
    - **Added**: shadcn/ui Card + Badge components, automatic dark/light theme support via CSS variables
    - **Layout**: Compact side-by-side grid+metrics (~200-250px tall, down from ~500px = 2.5x information density)
    - **Metrics**: 6-point tabular display (Correctness, Attempts, Models, Grid, Tests) with `text-[10px]` labels
    - **Theme support**: Uses CSS variables (`bg-card`, `text-card-foreground`, `border`, `text-muted-foreground`) for automatic theme adaptation
    - **Design inspiration**: arXiv.org, Google Scholar, GitHub, Nature Journal (professional scientific platforms)
  - **PuzzleBrowser grid improvements**: Updated responsive breakpoints for compact cards (`client/src/pages/PuzzleBrowser.tsx:418`)
    - Mobile: 1 column | sm: 2 | md: 3 | xl: 4 | 2xl: 5 columns (new!)
    - Gap increased to 12px (`gap-3`) for compact card spacing
    - Shows 2.5x more puzzles per viewport
  - **Scalability**: Design pattern reusable across PuzzleExaminer and other puzzle list views using shadcn/ui primitives

- Bug Fixes
  - **PuzzleCard correctness display for unsolved puzzles**: Fixed misleading "Solve Rate: 0%" on PuzzleDBViewer (which shows only unsolved puzzles) by implementing context-aware display (`client/src/components/puzzle/PuzzleCard.tsx:157-167`)
    - Shows "Never Tried" for puzzles with 0 attempts
    - Shows "Unsolved" for puzzles with failed attempts (0% accuracy)
    - Shows "X% Solved" only when accuracy > 0
  - **PuzzleBrowser junk sort modes removed**: Deleted confidence, cost, and created_at sort options that had no basis in aggregated metrics (`client/src/pages/PuzzleBrowser.tsx:121-125, 333-338`)
    - Kept useful sorts: unsolved_first (recommended), unexplained_first, least_analysis_data, processing_time
  - **PuzzleBrowser Trading Cards banner removed**: Deleted promotional banner for cleaner, focused research interface (`client/src/pages/PuzzleBrowser.tsx`)

- Documentation
  - **Professional redesign plan**: Created comprehensive 1,301-line design specification documenting transformation from cartoon to scientific aesthetic (`docs/2025-11-21-puzzlecard-professional-redesign-plan.md`)

### Version 5.16.8

- Planning
  - **PuzzleDBViewer metrics + grid fix plan**: Captured the backend/frontend steps to replace the hallucinated solve rate with binary correctness, surface real model counts, and keep TinyGrid previews readable for extreme aspect ratios (`docs/2025-11-20-puzzledbviewer-metrics-fix-plan.md`).

### Version 5.16.7

- Bug Fixes
  - **Puzzle Examiner color-only toggle now fully hides digits**: Fixed the memoization dependencies in `PuzzleGrid` so `showColorOnly` is included in the `gridContent` `useMemo`. This ensures grid cells re-render when color-only mode is toggled, allowing `GridCell` to correctly render transparent text and `null` content without stray numeric glyphs leaking through the UI (`client/src/components/puzzle/PuzzleGrid.tsx`).

### Version 5.16.6

- UI/UX & Metrics
  - **PuzzleDBViewer white theme**: Replaced the dark slate layout with a clean white page, light borders, and compact spacing so unsolved ARC evaluation puzzles are easier to scan at a glance (PuzzleDBViewer.tsx). Header, filters, and ARC2/ARC1 sections now match the rest of the app’s light styling while keeping ARC2-Eval as the clearly marked primary focus.
  - **Puzzle preview stats cleanup**: Simplified PuzzleCard metrics to only show grounded, research-relevant stats: solve rate (clamped 0–100%), total attempts, unique models tested, test-case mode (single vs multi), grid size, dataset, and optional cost badge (PuzzleCard.tsx). Removed confidence/trustworthiness badges and any paths that could surface >100% style percentages.
  - **Backend accuracy clamp**: Normalized aggregated `avgAccuracy` in the worst-performing puzzles query to always live in [0,1] before sending to the UI, so no combination of database state can produce impossible solve rates (ExplanationRepository.getWorstPerformingPuzzles).

### Version 5.16.6

- Bug Tracking
  - **Puzzle Examiner color-only toggle still leaking digits**: Despite routing `showColorOnly` through `PuzzleGrid`/`GridCell`, the rendered cells continue to display numeric glyphs in the browser. Latest attempt hides the React content in `GridCell.tsx` (returns `null` + accessibility label), but the UI still shows numbers. Needs follow-up to inspect any inherited styles or additional layers painting the digits (e.g., CSS pseudo-elements, DaisyUI utilities) before the feature can ship.

### Version 5.16.5

- Features
  - **Puzzle Examiner color-only grids**: Added a dedicated “Show Colors Only” toggle beside the emoji button so users can hide numeric labels and focus on raw palette comparisons (PuzzleExaminer.tsx, PuzzleHeader.tsx). The button automatically disables while in emoji mode, and the new state propagates through PuzzleGridDisplay → PuzzleGrid → GridCell so every training/test grid now supports color-only rendering plus accessible screen reader labels. Updated PuzzleGrid props/types to keep Saturn Visual Solver and other consumers compiling cleanly.

### Version 5.16.4

- UI/UX Improvements
  - **PuzzleDBViewer major UI overhaul**: Drastically reduced wasted vertical space (~400-450px saved) by redesigning the entire page layout
    - Replaced massive gradient header Card (~200px) with compact dark theme header (~50px) matching PuzzleBrowser style (PuzzleDBViewer.tsx:335-353)
    - Condensed bloated filter Card (~120px) into single compact inline row with minimal padding (PuzzleDBViewer.tsx:355-378)
    - Removed all gradient backgrounds from ARC2/ARC1 section Cards, replaced with clean dark theme borders (lines 402-428, 450-492)
    - Reduced section header text from `text-2xl` to `text-sm uppercase` and badge sizes from `text-base px-4 py-2` to `text-xs px-2 py-0.5`
    - Changed container padding from `p-6 space-y-6` to `pb-3 pt-2 px-2 gap-2` for consistency with PuzzleBrowser
    - Reduced grid gaps from `gap-3` to `gap-2` throughout
  - **PuzzleDBViewer new features**: Added visual puzzle grid cards below pill lists
    - Imported and integrated PuzzleCard component from PuzzleBrowser (PuzzleDBViewer.tsx:30)
    - Added PuzzleCard grid display (first 12 puzzles) below ARC2 evaluation pills with lazy-loaded TinyGrid previews (lines 430-442)
    - Added PuzzleCard grid display (first 12 puzzles) below ARC1 evaluation pills (lines 477-489)
    - Provides visual puzzle structure inspection without leaving the database browser
  - **PuzzleDBViewer navigation improvements**: All ClickablePuzzleBadge components now open puzzles in new tabs via explicit `openInNewTab={true}` prop (lines 425, 472) for better research workflow

### Version 5.16.3

- Bug Fixes
  - **Grok 4.1 Fast visibility & dedupe in analytics**: Fixed `normalizeModelName` so historical Grok 4 / Grok 4.1 aliases (including OpenRouter-specific names with `-attemptN` suffixes) correctly normalize to their canonical keys (`x-ai/grok-4-fast`, `x-ai/grok-4.1-fast`) without dropping the attempt suffix, and updated `MetricsRepository.combineModelComparisons()` to use the normalized accuracy/trustworthiness/feedback/cost maps. This makes Grok 4 / Grok 4.1 appear under single, consistent rows in the model comparison dashboards instead of being split or disappearing.

### Version 5.16.2

- Bug Fixes
  - **PuzzleDB Viewer build failure**: Repaired `client/src/pages/PuzzleDBViewer.tsx` by restoring the missing ARC1 filter memo plus the required UI/icon imports, eliminating the stray switch `case` that esbuild flagged so the Vite build can complete again.

### Version 5.16.1

- Bug Fixes
  - **Grok model normalization for analytics dashboards**: Updated `MetricsRepository.combineModelComparisons()` to rely on the shared `normalizeModelName` helper instead of preserving raw model names, and tightened `normalizeModelName` itself so OpenRouter aliases like `openrouter/sonoma-sky` and historical `openrouter/sherlock-think-alpha*` entries all collapse into their canonical Grok counterparts (`x-ai/grok-4-fast`, `x-ai/grok-4.1-fast`) in the cross-model matrix and comprehensive dashboard. This removes duplicate or missing Grok rows from analytics views while keeping underlying database rows unchanged.

### Version 5.16.0

- Features
  - **PuzzleDB Viewer & PuzzleCard refresh**: rebuilt `client/src/pages/PuzzleDBViewer.tsx` around unsolved ARC evaluation puzzles using shadcn/ui cards/badges, dataset badges, search + lazy TinyGrid previews, and a simpler action flow, while `client/src/components/puzzle/PuzzleCard.tsx` now surfaces many performance metrics (models attempted, cost, accuracy/correctness signals) so researchers can spot hard puzzles at a glance.
  - **PuzzleTradingCards filters & sorts**: prioritized ARC2/ARC1 evaluation sources, added the "All Evaluation" combined filter, and replaced imaginary "difficulty" labels with accuracy-based performance buckets plus new sorts tuned to LLM defeats (`client/src/pages/PuzzleTradingCards.tsx`).

- Bug Fixes
  - **Binary correctness for zero-accuracy filters**: `server/repositories/ExplanationRepository.ts` now counts explanations using `is_prediction_correct`/`multi_test_all_correct` so PuzzleDB Viewer reliably surfaces puzzles with zero correct explanations, aligning with the documented correctness pattern.

- Documentation
  - Added the PuzzleDB Viewer & PuzzleCard redesign plan so future contributors understand the intended research-focused UX (`docs/2025-11-20-puzzledb-and-puzzlecard-redesign-plan.md`).
  - Captured the Correctness Logic Pattern guide that explains how to aggregate single- and multi-test correctness flags without mixing metrics (`docs/reference/database/CORRECTNESS_LOGIC_PATTERN.md`).

### Version 5.15.1

- Bug Fixes / Performance
  - **Database Query Optimization**: Fixed PostgreSQL temporary disk space overflow on `/api/puzzles/stats` endpoint
    - Replaced expensive `STRING_AGG` operations with `COUNT(DISTINCT)` for model aggregation (ExplanationRepository.ts:908-1000)
    - Changed `modelsAttempted` from string array to `modelsAttemptedCount` number across frontend/backend
    - Changed `reasoningEfforts` from string array to `reasoningEffortsCount` number
    - Updated TypeScript interfaces: `PuzzlePerformanceSnapshot` (usePuzzleStats.ts:34-37), `PuzzlePerformanceData` (usePuzzleDBStats.ts:32-34)
    - Updated UI components to display counts instead of badges: PuzzleTradingCard, DifficultPuzzlesSection, PuzzleDBViewer
    - Dramatically reduced temp disk usage - query now processes 4000+ puzzles without overflow
    - Files modified: ExplanationRepository.ts, puzzleOverviewService.ts, usePuzzleStats.ts, usePuzzleDBStats.ts, puzzleCardHelpers.ts, PuzzleTradingCard.tsx, DifficultPuzzlesSection.tsx, PuzzleDBViewer.tsx

- Features
  - **Automated Database Maintenance**: Added comprehensive maintenance system with zero manual intervention required
    - Created `DatabaseMaintenance` class with automated cleanup tasks (server/maintenance/dbCleanup.ts):
      * Logs temp file statistics (count & size via `pg_ls_tmpdir()`)
      * Terminates idle queries stuck >5 minutes (`pg_terminate_backend`)
      * Forces PostgreSQL CHECKPOINT to clean orphaned temp files
      * Runs VACUUM ANALYZE on key tables (explanations, feedback, puzzles)
      * Reports database size, connection statistics, and space reclaimed
    - Integrated maintenance into server lifecycle (server/index.ts:117-136):
      * Runs automatically on startup after database initialization
      * Scheduled to run every 6 hours via `setInterval`
      * Non-blocking error handling (won't crash server)
    - Added manual execution script with detailed reporting (server/scripts/run-maintenance.ts)
    - Added npm script: `npm run db:maintenance` (package.json:14)
    - Deployment: No SSH access needed - maintenance runs automatically on every deploy
    - Monitoring: Check logs for `db-maintenance` and `maintenance-script` tags

- Documentation
  - Created comprehensive implementation guide: `docs/2025-11-21-postgres-temp-disk-fix.md`
    - Root cause analysis of temp disk overflow
    - Before/after query comparisons
    - All file changes with line numbers
    - Automated maintenance system documentation
    - Monitoring and troubleshooting guide

### Version 5.15.0

- Features
  - **PuzzleBrowser**: Added solved status tracking across backend and frontend
    - Added `isSolved` field to `BulkExplanationStatus` interface (IExplanationRepository.ts:165)
    - Updated `ExplanationRepository.getBulkExplanationStatus()` with SQL subquery to calculate solved status based on correct predictions (ExplanationRepository.ts:495-509)
    - Added `isSolved` to `EnhancedPuzzleMetadata` interface (puzzleService.ts:36, PuzzleBrowser.tsx:42)
    - Implemented new 'unsolved_first' sort with 3-tier priority system (PuzzleBrowser.tsx:98-112):
      1. Attempted but unsolved (highest research value)
      2. Solved puzzles
      3. Never attempted (lowest priority)
    - Changed default sort from 'unexplained_first' to 'unsolved_first' (PuzzleBrowser.tsx:51)
    - Added "Unsolved first (attempted) - recommended" dropdown option (PuzzleBrowser.tsx:333)

  - **PuzzleDBViewer**: Major UI overhaul for compact, efficient layout
    - Added TinyGrid puzzle previews with lazy-loaded IntersectionObserver pattern (PuzzleDBViewer.tsx:99-241)
    - Created new `CompactPuzzleCard` component with 64px grid preview showing first training example
    - Reduced card padding from `p-4` to `p-2` (50% space reduction)
    - Compacted metrics to `text-xs` grid layout with minimal spacing (`gap-1`)
    - Changed badges to `badge-sm` and buttons to `btn-xs` for tighter layout

- Refactoring / Cleanup
  - **PuzzleDBViewer**: Removed "Database Overview" card that wasted ~200px showing 4 trivial statistics (PuzzleDBViewer.tsx:928-962 deleted)
  - **PuzzleDBViewer**: Completely removed "Humble AI" categorization (arbitrary <80% confidence threshold with no scientific basis)
    - Removed from `getPuzzleInterestLevel()` priority system (PuzzleDBViewer.tsx:27-46)
    - Removed 'humble' sort option from dropdown (line 847)
    - Removed 'humble' case from sort logic (line 173)
    - Removed `humbleOnly` filter state and logic (lines 100, 143-145)
    - Removed `humble` count from aggregateStats (lines 269, 307)
    - Removed "Humble AI" card from difficulty distribution (lines 485-489)
    - Removed "Most Humble" comparative highlight (lines 643-657)
    - Removed from useMemo dependencies (line 195)
  - **PuzzleDBViewer**: Condensed filter section with DaisyUI compact classes
    - Search bar: Horizontal layout with `input-sm` and `btn-sm` (lines 773-798)
    - Sort/dataset dropdowns: Inline with `select-sm` (lines 800-856)
    - Checkboxes: Changed to `checkbox-xs` and inlined for space efficiency
    - Reduced overall spacing with `gap-3` instead of `gap-4`

- Documentation
  - Created `/docs/2025-11-20-add-solved-filter-plan.md` with 8-step implementation plan for PuzzleBrowser solved status
  - Created `/docs/2025-11-20-enhance-database-viewer-solved-status.md` with enhancement plan for PuzzleDBViewer
  - Created `/docs/2025-11-20-fix-database-viewer-ui-bloat.md` with detailed 6-step UI bloat fix plan including TinyGrid preview pattern

### Version 5.14.3

- Repo / Tooling
  - Updated `arc-agi-benchmarking` git submodule to point to `https://github.com/82deutschmark/arc-agi-benchmarking` instead of `https://github.com/arcprize/arc-agi-benchmarking`.

### Version 5.14.2

- Refactoring
  - Added client-side redirect component from `/human-cards` to `/hall-of-fame` to prevent broken links and preserve backwards compatibility

### Version 5.14.1

- Bug fixes
  - Fixed Jeremy Berman contributor card to display "High Score" badge without rank indicator
  - Removed rank display from 2024 ARC Prize winner cards (Daniel Franzen, Guillermo Barbadillo) for cleaner card presentation

- Refactoring
  - Renamed `/human-cards` endpoint to `/hall-of-fame` for better semantic clarity
  - Updated navigation, routes, and sitemap to reflect new endpoint URL

- Docs
  - Added `docs/reference/database/MULTI_TEST_CORRECTNESS_GUIDE.md` describing the multi-test correctness pipeline, field semantics, and UI/display patterns for future maintainers.

### Version 5.14.0

- LLM Reasoning docs
  - Added `/llm-reasoning` explainer page and `/llm-reasoning/advanced` research-style article.
  - Linked advanced article from the basic explainer header.

- Top navigation refactor (ARC-3 & Misc)
  - Replaced hover-based `NavigationMenu` dropdowns with click-to-open `DropdownMenu` components.
  - Fixed dropdown alignment and viewport so ARC‑3 / Misc menus open directly under their tabs and are no longer clipped by header overflow.
  - Reorganized navigation into grouped menus for ARC‑3 experiences and Misc tools with clearer active‑route highlighting.

- Analytics, SEO & AEO
  - Added sitemap, robots, and `llms.txt` plus canonical metadata and JSON‑LD to improve web and LLM discoverability.
  - Introduced model origin badges and labels in Analytics to distinguish official ARC Prize leaderboard runs from community runs.
  - Clarified evaluation harness copy and how analytics are generated from the shared ARC‑AGI benchmarking harness.

- Correctness & metrics fixes
  - Overhauled correctness logic across Accuracy, Trustworthiness, ModelDataset, and Metrics query helpers to correctly handle single vs multi‑prediction runs, NULLs, and JOIN duplication.
  - Updated trading card win‑rate and difficulty display to use consistent correctness semantics and percentage formatting.

- Contributors backend
  - Refactored `ContributorRepository` to extend `BaseRepository` and integrated it via `RepositoryService` and a new `contributorController`, fixing crashes on `/api/contributors` endpoints and aligning with the standard repository/controller pattern.
