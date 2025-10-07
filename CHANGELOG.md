## [2025-10-06]

## v3.6.4 - PuzzleDiscussion Page Complete Redesign

### Fixed
- **PuzzleDiscussion Landing Page Disaster** (Critical)
  - **Problem:** Landing page had 60+ lines of explanatory text instead of search functionality
  - **Solution:** Complete redesign focusing on action, not explanation

- **Overly Restrictive Eligibility Filtering** (Critical)
  - **Problem:** Required reasoning models (GPT-5, o-series, Grok-4) in addition to provider_response_id
  - **Solution:** Simplified to ONLY check: has provider_response_id + within 30-day retention window
  - **Rationale:** Any model with a provider_response_id can use conversation chaining if the provider supports it
  - Impact: Opens conversation chaining to all models that saved response IDs, not just reasoning models

- **Missing providerResponseId Field Mapping** (Critical)
  - **Problem:** Backend returned `providerResponseId` but frontend `useExplanation` hook didn't map it
  - **Impact:** ALL explanations appeared ineligible because frontend never saw the provider response ID
  - **Solution:** Added `providerResponseId: (raw as any).providerResponseId` mapping in useExplanation hook
  - **Root Cause:** Field was added to backend but never added to frontend data transformation
  - Files: `client/src/hooks/useExplanation.ts`

### Added
- **Backend API for Eligible Explanations**
  - **NEW:** `GET /api/discussion/eligible` endpoint
  - Filters explanations server-side for discussion eligibility:
    - Less than 30 days old (`created_at >= NOW() - INTERVAL '30 days'`)
    - Has `provider_response_id` (required for conversation chaining)
  - Returns: puzzle ID, model name, provider, age, eligibility status
  - Files: `server/controllers/discussionController.ts`, `server/routes.ts`

- **Frontend Hook for Eligible Explanations**
  - **NEW:** `client/src/hooks/useEligibleExplanations.ts`
  - Fetches and caches eligible explanations from API
  - Supports pagination and automatic refetching
  - File: `client/src/hooks/useEligibleExplanations.ts`

### Enhanced
- **PuzzleDiscussion Landing Page Redesign**
  - **Before:** Walls of explanatory text (60+ lines)
  - **After:** Clean, action-focused interface:
    - Simple search box: "Enter puzzle ID to begin..."
    - Table showing recent eligible analyses (puzzle ID, model, provider, age)
    - Direct "Refine" buttons linking to `/discussion/:puzzleId?select=:id`
    - No overwhelming explanations - focuses on getting users to action
  - Files: `client/src/pages/PuzzleDiscussion.tsx`

- **PuzzleDiscussion Puzzle Page Filtering**
  - Added client-side filtering for eligible explanations only
  - Shows clear warning when explanations exist but none are eligible
  - Criteria displayed clearly: age < 30 days, reasoning models only, has provider_response_id
  - Files: `client/src/pages/PuzzleDiscussion.tsx`

- **Component Button Text Customization**
  - **Enhanced:** `client/src/components/puzzle/AnalysisResultListCard.tsx`
  - Added `debateButtonText` prop for context-appropriate button text
  - Default: "Start Debate" (debate context), "Start Refinement" (discussion context)
  - Files: `client/src/components/puzzle/AnalysisResultListCard.tsx`, `client/src/components/puzzle/debate/ExplanationsList.tsx`

- **Reduced Explanatory Text in Components**
  - **Reduced:** `client/src/components/puzzle/debate/ExplanationsList.tsx`
  - Condensed 40-line explanation into 1 concise alert
  - Kept only essential information about reasoning persistence
  - Files: `client/src/components/puzzle/debate/ExplanationsList.tsx`

- **Improved Placeholder Text**
  - **Fixed:** `client/src/components/puzzle/debate/PuzzleDebateHeader.tsx`
  - Changed from "Enter puzzle ID to start debate..." to neutral "Enter puzzle ID..."
  - Files: `client/src/components/puzzle/debate/PuzzleDebateHeader.tsx`

### Technical Details

**Eligibility Criteria (Server-side filtering):**
```sql
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND provider_response_id IS NOT NULL
```

**Simplified Logic:**
- Originally required: reasoning model + provider_response_id + age < 30 days
- Now requires: provider_response_id + age < 30 days
- Rationale: Any model that saved a response ID can use conversation chaining

**Landing Page Structure:**
```typescript
// Before: 60+ lines of explanatory text
// After: Action-focused interface
<Card> // Search box
<Card> // Recent eligible table with direct links
```

**Client-side Filtering:**
```typescript
// Only show explanations that are eligible for discussion
const filteredEligibleExplanations = explanations.filter(exp => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return new Date(exp.createdAt) >= thirtyDaysAgo
    && exp.providerResponseId; // Only 2 checks now!
});
```

### Impact
- **UX Revolution:** Landing page now focuses on search and recent eligible analyses instead of overwhelming text
- **Clarity:** Users can immediately see what analyses are eligible for discussion
- **Efficiency:** Direct navigation to eligible puzzles with one click
- **Maintainability:** Server-side filtering reduces client-side complexity
- **Scalability:** API supports pagination for large datasets
- **Feature Accessibility:** Simplified filtering makes conversation chaining available to ALL models with response IDs, not just reasoning models

### Files Created
- `server/controllers/discussionController.ts` - NEW: Discussion eligibility API
- `client/src/hooks/useEligibleExplanations.ts` - NEW: Hook for fetching eligible explanations

### Files Modified
- `server/routes.ts` - Added discussion API endpoint
- `client/src/pages/PuzzleDiscussion.tsx` - Complete redesign (landing + puzzle pages)
- `client/src/components/puzzle/AnalysisResultListCard.tsx` - Added button text customization
- `client/src/components/puzzle/debate/ExplanationsList.tsx` - Reduced text, context-aware buttons
- `client/src/components/puzzle/debate/PuzzleDebateHeader.tsx` - Improved placeholder text

---

## v3.6.3 - PuzzleDiscussion Feature Discoverability & UI Enhancements

### Added
- **DifficultPuzzlesSection Component**
  - Extracted 'Most Difficult Puzzles' functionality from PuzzleDiscussion
  - Created dedicated reusable component (687 lines)
  - Added to AnalyticsOverview page where it properly belongs
  - Maintains all filtering/sorting logic from original implementation
  - Fixes SRP violation: PuzzleDiscussion should be for conversations, not analytics
  - Users can now find worst-performing puzzles in the analytics dashboard
  - Files: `client/src/components/analytics/DifficultPuzzlesSection.tsx`, `client/src/pages/AnalyticsOverview.tsx`

### Added
- **"Refine This Analysis" Badge in AnalysisResultHeader**
  - Purple/blue gradient badge appears next to "Get a second opinion!" badge
  - Links directly to `/discussion/:puzzleId?select=:explanationId`
  - Auto-starts progressive reasoning conversation with selected explanation
  - Strict eligibility checks ensure badge only shows when feature will work:
    * Must be reasoning model (GPT-5, o-series, Grok-4)
    * Must have `providerResponseId` in database
    * Must be created after Oct 6, 2025 (implementation date)
    * Must be within 30-day provider retention window
    * Prevents confusion from expired or unsupported analyses
  - Files: `client/src/components/puzzle/AnalysisResultHeader.tsx`

- **Auto-Selection Query Parameter Support**
  - PuzzleDiscussion now supports `?select=:explanationId` URL parameter
  - Automatically starts conversation when explanation ID provided
  - Enables direct deep-linking to specific explanations from other pages
  - Console logging for debugging auto-selection behavior
  - Files: `client/src/pages/PuzzleDiscussion.tsx`

### Enhanced
- **PuzzleDiscussion Welcome Screen**
  - Completely redesigned to emphasize server-side reasoning persistence
  - Prominent callout explaining 30-day reasoning token retention
  - Visual token growth examples (Turn 1: 45k → Turn 2: accesses 45k, etc.)
  - Cost savings explanation (no re-sending reasoning tokens)
  - Provider requirements clearly stated (GPT-5, o-series, Grok-4)
  - Updated button text: "Refine Analysis" instead of "Ask other LLM"
  - Files: `client/src/pages/PuzzleDiscussion.tsx`

- **ExplanationsList Context Awareness**
  - Added `pageContext` prop ('debate' | 'discussion')
  - Context-aware UI text for PuzzleDiscussion vs ModelDebate:
    * Discussion: "Select Analysis to Refine" + reasoning persistence explanation
    * Debate: "Explanations Available for Debate" (unchanged)
  - Reasoning persistence alert box (discussion context only):
    * Explains server-side storage and full context retention
    * Shows provider compatibility warnings for non-reasoning models
    * Displays before user selects explanation
  - Auto-detects non-reasoning models and shows compatibility warning
  - Files: `client/src/components/puzzle/debate/ExplanationsList.tsx`

- **Reasoning Token Metrics Display**
  - Added reasoning token display to RebuttalCard component
  - Added reasoning token display to OriginalExplanationCard component
  - Shows per-turn reasoning tokens with visual progress bar (0-100k scale)
  - Displays cumulative reasoning token count across conversation
  - Purple-themed UI matching reasoning persistence branding
  - Files: `client/src/components/puzzle/debate/RebuttalCard.tsx`, `client/src/components/puzzle/debate/OriginalExplanationCard.tsx`

- **IndividualDebate Component Customization**
  - Added `challengeButtonText` prop for context-specific button labels
  - PuzzleDiscussion: "Refine Analysis" button
  - ModelDebate: "Generate Challenge" button (default)
  - Files: `client/src/components/puzzle/debate/IndividualDebate.tsx`

- **Active Conversation Status Alerts**
  - Shows reasoning chain status when conversation is active
  - Displays total accessible reasoning tokens
  - Provider badges (OpenAI/xAI) with 30-day retention indicator
  - Turn count and provider information
  - Files: `client/src/pages/PuzzleDiscussion.tsx`

### Fixed
- **Missing Context in ExplanationsList**
  - PuzzleDiscussion users previously saw confusing ModelDebate language
  - "Start Debate" button now says "Start Refinement" in discussion context
  - Reasoning persistence feature no longer hidden until after selection

### Technical Details

**Helper Functions Added:**
```typescript
// AnalysisResultHeader.tsx
isReasoningModel(modelName: string): boolean
canRefineAnalysis(result: ExplanationData): boolean

// PuzzleDiscussion.tsx
isReasoningModel(modelName: string): boolean
getProviderName(modelName: string): string
```

**Eligibility Logic:**
Badge shows ONLY when ALL criteria met:
1. Model is GPT-5, o-series (o3, o4, o4-mini), or Grok-4
2. Has `providerResponseId` stored in database
3. Created after Oct 6, 2025 00:00:00 UTC
4. Created within last 30 days
5. Has both puzzle ID and explanation ID

**URL Parameter Format:**
```
/discussion/:puzzleId?select=:explanationId
Example: /discussion/42a15761?select=123
```

### Impact
- **Discoverability**: Users can now find PuzzleDiscussion from PuzzleExaminer
- **Education**: Clear explanations of reasoning persistence before use
- **Safety**: Strict checks prevent badge from showing for incompatible analyses
- **UX**: Auto-selection eliminates extra navigation step
- **Clarity**: Distinct UI language for discussion vs debate contexts

### Files Modified
- `client/src/components/puzzle/AnalysisResultHeader.tsx` - Badge + eligibility checks
- `client/src/components/puzzle/debate/ExplanationsList.tsx` - Context awareness
- `client/src/components/puzzle/debate/RebuttalCard.tsx` - Reasoning metrics
- `client/src/components/puzzle/debate/OriginalExplanationCard.tsx` - Reasoning metrics
- `client/src/components/puzzle/debate/IndividualDebate.tsx` - Button customization
- `client/src/pages/PuzzleDiscussion.tsx` - Welcome screen + auto-selection + status alerts

---

## v3.6.2 - Responses API Conversation Chaining (Complete Implementation)

### Fixed
- **Responses API Conversation Chaining Data Loss**
  - Added `providerResponseId` field to `AIResponse` interface
  - Updated `buildStandardResponse()` to extract and pass through `result.id`
  - Root cause: Both grok.ts and openai.ts captured response.id, but buildStandardResponse() never included it in final AIResponse object
  - Impact: `provider_response_id` now properly saved to database for all analyses
  - Files: `server/services/base/BaseAIService.ts` (lines 62, 263)

### Added
- **API Endpoint Support for Conversation Chaining**
  - Added `previousResponseId` parameter to `/api/puzzle/analyze/:taskId/:model` endpoint
  - Enables multi-turn conversations with full context retention
  - Pass-through implementation: Controller → AnalysisService → AI Service → API
  - Files: 
    - `server/controllers/puzzleController.ts` (line 78) - Request body extraction
    - `server/services/puzzleAnalysisService.ts` (lines 50, 83, 117) - Service orchestration
  
- **Complete API Documentation**
  - Created comprehensive conversation chaining guide
  - Includes usage examples, error handling, best practices
  - Documents provider support (OpenAI, xAI) and limitations
  - File: `docs/API_Conversation_Chaining.md`

### Technical Details

**Problem:**
```typescript
// API Response → parsedResponse.id = result.id  ✅ (grok.ts:504, openai.ts:538)
// parseProviderResponse() → returns result with .id  ✅
// buildStandardResponse() → AIResponse object  ❌ Missing providerResponseId
// Repository.create() → saves NULL to database  ❌
```

**Solution:**
```typescript
// 1. Added field to AIResponse interface (line 62):
providerResponseId?: string | null;

// 2. Extracted response.id in buildStandardResponse() (line 263):
providerResponseId: result?.id || null,
```

**Impact:**
- ✅ Enables conversation chaining via `previous_response_id` parameter
- ✅ Supports iterative puzzle refinement workflows
- ✅ Enables debate mode with full conversation context
- ✅ Allows conversation forking for exploration workflows
- ✅ Maintains 30-day server-side state for OpenAI/xAI models

**Conversation Chaining Features Now Available:**
- Multi-turn puzzle analysis with full context
- Automatic access to previous reasoning items
- Server-side encrypted reasoning storage (30 days)
- Conversation branching and forking
- Iterative puzzle refinement workflows
- Enhanced debate mode with conversation history

### Files Modified
- `server/services/base/BaseAIService.ts` - Added providerResponseId field and pass-through
- `server/controllers/puzzleController.ts` - Added previousResponseId parameter
- `server/services/puzzleAnalysisService.ts` - Added conversation chaining support
- `docs/API_Conversation_Chaining.md` - NEW: Complete API documentation

### API Usage Example
```bash
# Request 1: Initial analysis
curl -X POST "/api/puzzle/analyze/00d62c1b/openai%2Fo4-mini" \
  -H "Content-Type: application/json" \
  -d '{"promptId": "solver"}'

# Response 1: {"providerResponseId": "resp_abc123"}

# Request 2: Follow-up with context
curl -X POST "/api/puzzle/analyze/00d62c1b/openai%2Fo4-mini" \
  -H "Content-Type: application/json" \
  -d '{"promptId": "solver", "previousResponseId": "resp_abc123"}'
```

### Debate Mode Integration ⭐ NEW
Model Debate system now uses conversation chaining automatically:
- Each debate turn includes full context from previous turns
- Models remember all previous arguments and rebuttals
- **Provider-aware chaining**: Automatically detects OpenAI vs xAI models
- Cross-provider debates start new chains (no context loss, just new conversation)
- No manual response ID management needed
- Files: `client/src/pages/ModelDebate.tsx`, `client/src/hooks/debate/useDebateState.ts`, `client/src/hooks/useAnalysisResults.ts`

### Provider Compatibility ⚠️ IMPORTANT
Conversation chaining is provider-specific:
- ✅ OpenAI models (GPT-4, o4-mini, o3, o1) can chain with each other
- ✅ xAI models (Grok-4, Grok-3) can chain with each other  
- ⚠️ Cross-provider debates (GPT → Grok or Grok → GPT) start fresh conversations
- Response IDs are not compatible across providers (OpenAI IDs ≠ xAI IDs)
- System automatically handles this via provider detection in `useDebateState.extractProvider()`

### Related Documentation
- `docs/API_Conversation_Chaining.md` - Complete API usage guide with debate examples
- `docs/Debate_Conversation_Chaining_Plan.md` - Debate implementation plan
- `docs/Responses_API_Chain_Storage_Analysis.md` - Technical analysis and implementation details
- `CLAUDE.md` - Updated with conversation chaining architecture

---

## v3.6.1 - Critical Variable Shadowing Fix + Responses API Chain Analysis

### Fixed
- **Variable Shadowing Bug in Responses API Services**
  - Fixed `request is not a function` TypeError in Grok and OpenAI services
  - Root cause: Imported `request` from undici, then shadowed with local variables/parameters
  - Renamed import to `undiciRequest`, local vars to `requestData`
  - Affected: grok.ts (lines 27, 394, 407, 450), openai.ts (lines 17, 245, 440, 484)
  - Files: `server/services/grok.ts`, `server/services/openai.ts`

- **OpenRouter Service Verified**
  - Confirmed no variable shadowing bug (uses `request` directly without shadowing)
  - Extended timeout implementation from commit 285d496 works correctly
  - File: `server/services/openrouter.ts`

### Added
- **Comprehensive Responses API Chain Analysis**
  - Researched OpenAI and xAI conversation chaining with `previous_response_id`
  - Documented encrypted reasoning storage and 30-day retention
  - Identified implementation gap: `providerResponseId` captured but not passed through
  - Analysis shows database ready, API calls correct, but `buildStandardResponse()` missing field
  - File: `docs/Responses_API_Chain_Storage_Analysis.md`

### Technical Details

**Variable Shadowing Bug:**
```javascript
// BEFORE (broken):
import { request } from "undici";        // Import function
const request = { model: ... };          // Shadow with object
await request('https://...');            // TypeError: request is not a function

// AFTER (fixed):
import { request as undiciRequest } from "undici";  // Aliased import
const requestData = { model: ... };                 // Different name
await undiciRequest('https://...');                 // ✅ Works
```

**Chain Storage Gap Identified:**
1. ✅ Database has `provider_response_id` column
2. ✅ grok.ts and openai.ts capture `result.id` from API responses
3. ✅ Repository saves `data.providerResponseId` to database
4. ❌ **BROKEN:** `AIResponse` interface missing `providerResponseId` field
5. ❌ **BROKEN:** `buildStandardResponse()` doesn't pass through `result.id`

**Impact:** Response IDs are captured but lost before database insertion, preventing conversation chaining features.

**Responses API Chain Features (from research):**
- `previous_response_id` enables multi-turn conversations with context
- `store: true` enables server-side state persistence (30-day retention)
- Automatic access to previous reasoning items in follow-up requests
- Supports conversation forking and branching workflows
- OpenAI fully documented, xAI implementation unclear but structure matches

### Files Modified
- `server/services/grok.ts` - Fixed variable shadowing bug
- `server/services/openai.ts` - Fixed variable shadowing bug
- `docs/Responses_API_Chain_Storage_Analysis.md` - New comprehensive analysis

### Next Steps
To enable conversation chaining:
1. Add `providerResponseId?: string | null` to `AIResponse` interface
2. Update `buildStandardResponse()` to include `providerResponseId: result?.id || null`
3. Test that `provider_response_id` saves correctly to database
4. Add API parameter for `previousResponseId` in analysis requests
5. Implement UI for viewing and managing response chains

---

## v3.6.0 - Grok-4 Responses API Integration + Model Routing Cleanup

### Fixed
- **xAI Grok-4 API Integration**
  - Fixed invalid `reasoning` configuration being sent to grok-4 models (not supported per xAI docs)
  - Removed attempt to extract `reasoning_content` (grok-4 doesn't expose reasoning)
  - Cleaned up grok.ts to only handle Grok-4 variants (grok-4, grok-4-fast)
  - File: `server/services/grok.ts`

- **Model Routing Architecture**
  - Moved Grok-3 models to OpenRouter (use Chat Completions API)
  - Updated 4 model entries: x-ai/grok-3, x-ai/grok-3-mini, x-ai/grok-code-fast-1, x-ai/grok-3-mini-fast
  - Clear separation: grok.ts = Grok-4 (Responses API), openrouter.ts = Grok-3 (Chat Completions)
  - File: `server/config/models.ts`

- **Trustworthiness Leaderboard Filtering**
  - Applied minimum 20 attempts filter to trustworthiness leaderboard
  - Ensures statistical significance in displayed rankings
  - File: `server/controllers/puzzleController.ts`

- **Leaderboards Page Layout**
  - Removed padding and width constraints for full-viewport display
  - Changed from `p-4 max-w-7xl` to full-width layout
  - File: `client/src/pages/Leaderboards.tsx`

### Enhanced
- **Documentation Updates**
  - Added comprehensive xAI/Grok API differences section in CLAUDE.md
  - Documented Responses API vs Chat Completions API differences
  - Explained grok-4 limitations (no reasoning_effort, no reasoning_content)
  - Documented model routing logic for grok-4 vs grok-3
  - Created detailed plan document: `docs/06102025-Grok4-ResponsesAPI-Fix.md`
  - File: `CLAUDE.md`

### Technical Details
- **Grok-4 API Behavior** (per xAI docs):
  - ❌ Does NOT support `reasoning_effort` parameter
  - ❌ Does NOT return `reasoning_content` in responses
  - ✅ Supports Responses API with structured JSON output
  - ✅ Tracks reasoning tokens (but doesn't expose the reasoning itself)

- **Model Separation Strategy**:
  - Grok-4 models (grok-4, grok-4-fast) → Direct xAI API via grok.ts
  - Grok-3 models (all variants) → OpenRouter via openrouter.ts
  - Future grok-4 variants will automatically route to grok.ts

### Files Modified
- `server/services/grok.ts` - Removed grok-3 support, fixed reasoning config
- `server/config/models.ts` - Updated grok-3 models to use OpenRouter
- `server/controllers/puzzleController.ts` - Added min attempts filter
- `client/src/pages/Leaderboards.tsx` - Full-width layout
- `CLAUDE.md` - Updated API documentation
- `docs/06102025-Grok4-ResponsesAPI-Fix.md` - Implementation plan

---

## v3.6.4 - 2025-10-07 — Grok‑4 Structured Outputs + Batch Stability

- Enable xAI Grok‑4/Grok‑4‑fast structured outputs using Responses API `response_format.json_schema`.
  - New minimal schema: `server/services/schemas/grokJsonSchema.ts` (shallow nesting, arrays-of-arrays of integers, no minLength/minItems/allOf, additionalProperties:false).
  - GrokService now sends `response_format.json_schema` for Grok‑4 variants and reads `output_parsed` when present.
  - One‑shot graceful fallback: on provider grammar/schema error (400/422/503), retry once without schema; still parse JSON from text.
- Transport hardening for xAI:
  - Shared undici Agent + bounded retries with jitter for 429/5xx/transient network errors.
- Batch script improvements for safe runs on ARC2‑eval:
  - Concurrency‑capped worker pool (default `XAI_MAX_CONCURRENCY=2`) across Grok scripts.
  - `scripts/grok-4-fast-reasoning.ts`: add `--tail N` and `--limit N` to easily smoke‑test subsets; respects env `XAI_MAX_RETRIES`, `XAI_RETRY_BASE_DELAY_MS`.
- Docs + knowledge
  - Added `docs/2025-10-07-grok4-structured-outputs-enable-arc2-batch.md` (request shape, schema constraints, fallback, run settings).
  - Appended Grok‑4 structured outputs ops notes to `knowledge.md`.
- Validation (smoke test)
  - Ran last 10 ARC2‑eval tasks via `grok-4-fast-reasoning` with `--tail 10`.
  - Concurrency=2, retries=2. All completed successfully; `output_parsed` consumed when available; fallback path verified clean.
- Notes
  - No breaking changes. Existing parsing fallbacks preserved. OpenAI and other providers unaffected.

---

## [2025-10-05]

## v3.5.4 - Enhanced Leaderboards with Data Quality Indicators

### Added
- **Dedicated Leaderboards Page** (`/leaderboards`)
  - New standalone page for comprehensive model performance analysis
  - Three leaderboards: Overconfident Models, Trustworthiness Leaders, Feedback Analysis
  - Metrics explanation panel for user education
  - Clean, focused interface without clutter
  - Route added to App.tsx
  - File: `client/src/pages/Leaderboards.tsx`

- **Tooltip System for All Metrics**
  - AccuracyLeaderboard: Tooltips for overconfidence rate, confidence, accuracy
  - TrustworthinessLeaderboard: Tooltips for trustworthiness score, processing time, cost
  - FeedbackLeaderboard: Tooltips for helpful percentage and feedback counts
  - Uses shadcn/ui Tooltip component for consistent UX
  - Hover over any metric badge to see detailed explanation

- **Sample Size Warnings**
  - Visual warnings for models with <10 attempts (yellow badge with Info icon)
  - Prevents misleading conclusions from insufficient data
  - Tooltip explains why sample size matters
  - Applied across all three leaderboard components

### Enhanced
- **AccuracyLeaderboard Component**
  - Added tooltips to all metric badges (overconfidence rate, avg confidence, accuracy)
  - Sample size warnings for models with <10 attempts
  - Improved visual hierarchy with `cursor-help` on interactive elements
  - Updated header comments and documentation
  - File: `client/src/components/overview/leaderboards/AccuracyLeaderboard.tsx`

- **TrustworthinessLeaderboard Component**
  - Added tooltips for trustworthiness score explaining confidence reliability
  - Tooltips for accuracy badges on overconfident models
  - Sample size warnings integrated with overconfident model detection
  - Updated imports and documentation
  - File: `client/src/components/overview/leaderboards/TrustworthinessLeaderboard.tsx`

- **FeedbackLeaderboard Component**
  - Added tooltips for helpful percentage badges in both sections
  - Sample size warnings for models with <10 feedback entries
  - Applied to both "Most Appreciated" and "Most Criticized" sections
  - Improved component header documentation
  - File: `client/src/components/overview/leaderboards/FeedbackLeaderboard.tsx`

### Impact
- **Data Quality Transparency**: Users can now see when statistics may be unreliable
- **User Education**: Tooltips explain complex metrics without cluttering the UI
- **Better Decision Making**: Sample size warnings prevent over-reliance on low-confidence data
- **Dedicated Space**: Leaderboards have their own page, reducing AnalyticsOverview complexity

## v3.5.3 - Analytics Cleanup: Documentation & SQL Normalization

### Fixed
- **Documentation Accuracy** (Critical)
  - Corrected CLAUDE.md line 116: `prediction_accuracy_score` doesn't exist in database
  - Actual column name is `trustworthiness_score` (FLOAT)
  - Clarified distinction between accuracy (boolean correctness) vs trustworthiness (confidence reliability)
  - Removed misleading `prediction_accuracy_score` references from repository comments

### Enhanced
- **SQL Normalization Consistency**
  - Updated AccuracyRepository inline SQL to match `modelNormalizer.ts` logic
  - Updated TrustworthinessRepository inline SQL to match `modelNormalizer.ts` logic
  - Added sonoma-sky → grok-4-fast alias mapping to SQL CASE statements
  - Added `-beta` and `-alpha` suffix handling (previously only had `:beta`, `:alpha`)
  - Added comments linking SQL normalization to modelNormalizer.ts utility
  - Ensures database aggregation matches application-level normalization

### Context
- **Repository Clarity**
  - AccuracyRepository: Pure puzzle-solving correctness (boolean fields: is_prediction_correct, multi_test_all_correct)
  - TrustworthinessRepository: Confidence reliability (computed metric combining confidence + correctness)
  - Each repository has single, well-defined responsibility (SRP compliant)

## v3.5.2 - Model Name Normalization

### Fixed
- **Database Model Name Normalization** (Critical)
  - Normalized 438 database records to remove version suffixes and consolidate model aliases
  - Consolidated fragmented model statistics for accurate analytics
  - Mappings applied:
    - `x-ai/grok-4-fast:free` → `x-ai/grok-4-fast` (23 records)
    - `openrouter/sonoma-sky-alpha` → `openrouter/sonoma-sky` → `x-ai/grok-4-fast` (64 records - sonoma-sky was actually grok-4-fast)
    - `moonshotai/kimi-dev-72b:free` → `moonshotai/kimi-dev-72b` (153 records)
    - `deepseek/deepseek-r1-0528:free` → `deepseek/deepseek-r1-0528` (112 records)
    - `z-ai/glm-4.5-air:free` → `z-ai/glm-4.5` (22 records)
  - Total: 87 records now consolidated under `x-ai/grok-4-fast` (23 + 64)
  - Script: `server/scripts/normalize-model-names.ts`
  - Author: Claude Code using Sonnet 4.5

### Added
- **Model Normalizer Enhancements**
  - Added support for hyphen-style suffixes (`-alpha`, `-beta`)
  - Previously only handled colon-style suffixes (`:alpha`, `:beta`, `:free`)
  - Added model alias mapping: `openrouter/sonoma-sky` → `x-ai/grok-4-fast`
  - Ensures consistent normalization across all repositories
  - File: `server/utils/modelNormalizer.ts`

## [2025-10-04]

## v3.5.1 - Default Reasoning Effort Update

### Changed
- **CompactPuzzleDisplay Spacing** (UX Enhancement)
  - Increased gaps between grids for better visual clarity
  - Main container gap: gap-2 → gap-6 (between training and test sections)
  - Training examples gap: gap-3 → gap-6 (between example pairs)
  - Individual training example gap: gap-2 → gap-4 (between input/output)
  - Test cases gap: gap-3 → gap-8 (between test cases)
  - Individual test case gap: gap-2 → gap-4 (between input/output)
  - Reduces visual clutter on ModelDebate page
  - Files: client/src/components/puzzle/CompactPuzzleDisplay.tsx
  - Author: Cascade using Sonnet 4

- **ModelDebate Page Layout** (Enhancement)
  - Removed container margins, padding, and max-width constraints
  - Changed from `container mx-auto p-1 max-w-7xl` to `w-full`
  - Explanation cards now use full horizontal width of the viewport
  - Applied consistently across loading, error, and main interface states
  - Files: client/src/pages/ModelDebate.tsx
  - Author: Cascade using Sonnet 4

- **GPT-5 Reasoning Effort Default** (Enhancement)
  - Changed default `reasoningEffort` from `'low'` to `'high'` across frontend and backend
  - **Client-side**: useAnalysisResults hook now defaults to 'high' (line 62)
  - **Server-side**: OpenAI service now defaults to 'high' for both prompt preview (line 158) and API calls (line 230)
  - Also updated default `reasoningVerbosity` from 'medium' to 'high' for consistency (line 163)
  - Applies to all GPT-5 reasoning models (gpt-5-2025-08-07, gpt-5-mini-2025-08-07, gpt-5-nano-2025-08-07)
  - Users can still manually override these settings in the UI
  - Ensures maximum reasoning quality by default for GPT-5 models
  - Files: 
    - client/src/hooks/useAnalysisResults.ts (line 62)
    - server/services/openai.ts (lines 158, 163, 230)
  - Author: Cascade using Sonnet 4

## [2025-10-03]

## v3.5.0 - Bug Fixes and Deep Linking

### Added
- **Deep Linking to Specific Explanations** (Feature)
  - Users can now share direct links to specific AI explanations
  - URL format: `/puzzle/{puzzleId}?highlight={explanationId}`
  - Example: `/puzzle/0934a4d8?highlight=20779` jumps directly to explanation #20779
  - Features:
    - Auto-scroll to highlighted explanation on page load
    - Visual highlight effect (blue ring pulse for 3 seconds)
    - Copy Link button on each AnalysisResultCard
    - Toast notification when link copied to clipboard
    - Works across all pages showing explanations (Examiner, Feedback, Debate)
  - Implementation:
    - Added `id="explanation-{id}"` and `data-explanation-id` attributes to AnalysisResultCard wrapper
    - Added `scroll-mt-20` Tailwind class for proper scroll positioning
    - Added query parameter handling in PuzzleExaminer with smooth scroll behavior
    - Copy Link button uses clipboard API and toast notifications
    - Hidden in ELO mode (doesn't show for unsaved explanations)
  - Files: client/src/components/puzzle/AnalysisResultCard.tsx, AnalysisResultHeader.tsx, client/src/pages/PuzzleExaminer.tsx
  - Commit: 577ef99

### Fixed
- **"Some Incorrect" Bug - Root Cause Fixed** (CRITICAL)
  - THE BUG WAS IN THE SHARED UTILITY ITSELF - `shared/utils/correctness.ts`
  - Line 78 returned `'Some Incorrect'` for ALL multi-test failures, even 0/N correct
  - Root cause chain:
    1. Components invented their own logic (ExplanationResultsSection, AnalysisResultGrid) - FIXED in 358296d
    2. Components used shared utility (ExplanationsList, AnalysisResultListCard) - BUG PROPAGATED
    3. **The shared utility had the bug** - returning "Some Incorrect" when it should say "Incorrect"
  - Logic error: `multiTestAllCorrect === false` means "NOT all correct" (could be 0/N or some failed)
  - Without detailed validation data, cannot distinguish "all" vs "some" incorrect
  - Solution: Removed hasMultiplePredictions check, now always returns "Incorrect" for failures
  - Impact: Fixes bug in ALL components simultaneously (single source of truth)
  - Files: shared/utils/correctness.ts, ExplanationResultsSection.tsx, AnalysisResultGrid.tsx
  - Commits: 358296d (component fixes), 0cfbafa (root cause fix)

- **Multi-Test Accuracy Display** (Critical)
  - Fixed "0/2 correct" showing "Some Incorrect" instead of "Incorrect"
  - Root cause: multiTestStats fallback logic was using multiTestAverageAccuracy (calibration score) to estimate correctCount
  - Solution: Simplified logic to rely ONLY on multiTestAllCorrect boolean flag
    - When multiTestAllCorrect === false → "Incorrect" with 0 correct
    - When multiTestAllCorrect === true → "All Correct" with totalCount correct
  - Removed unreliable estimation from multiTestAverageAccuracy field
  - Files: client/src/components/puzzle/AnalysisResultCard.tsx
  - Commits: fde0dd9, 356de4f

- **Trustworthiness Badge Display**
  - Restored trustworthiness badge (predictionAccuracyScore) to AnalysisResultCard
  - Conditional display: shows only in non-ELO, non-debate, non-Saturn contexts
  - Badge shows calibration score as "Trustworthiness: X%" with color coding
  - Properly hidden in debate components and ELO mode as requested
  - Files: client/src/components/puzzle/AnalysisResultContent.tsx
  - Commit: 356de4f

- **ModelDebate Nested Scroll Box** (UX)
  - Removed nested scroll container in IndividualDebate.tsx
  - Changed from `h-[calc(100vh-280px)] overflow-y-auto` to natural page flow
  - Debate cards now display exactly like PuzzleExaminer results
  - Eliminated scroll-within-scroll pattern for better UX
  - Files: client/src/components/puzzle/debate/IndividualDebate.tsx
  - Commit: 07d4cd6

### Improved
- **AnalysisResultListCard UI Cleanup**
  - Removed trophy emoji from confidence display
  - Changed from icon-based to simple "Confidence: X%" text
  - Cleaner, less cluttered list view
  - Files: client/src/components/puzzle/AnalysisResultListCard.tsx
  - Commit: 356de4f

- **Component File Headers**
  - Added proper headers to AnalysisResultContent.tsx, AnalysisResultHeader.tsx, AnalysisResultGrid.tsx, AnalysisResultMetrics.tsx
  - Updated headers to reflect recent fixes and changes
  - Commit: fde0dd9

## [2025-10-01]

## v3.4.1 - Admin Hub Fixes

### Fixed
- **Admin Hub Quick Stats Bug** (Critical)
  - Fixed 500 error on `/api/admin/quick-stats` endpoint
  - Root cause: Controller called non-existent `getAllExplanations()` method
  - Solution: Added `countExplanations()` method to ExplanationRepository
  - Added `db` property to RepositoryService for direct SQL queries (marked deprecated)
  - All adminController errors resolved
  - Commits: c048930, c5f9fe6

- **HuggingFace Ingestion Button Not Working** (Critical)
  - Frontend button showed alert placeholder instead of triggering ingestion
  - Root cause: Missing `/api/admin/start-ingestion` backend endpoint
  - Solution:
    - Exported `ingestHuggingFaceDataset` function from ingestion script
    - Added `startIngestion()` controller function in adminController
    - Registered route in server/routes.ts
    - Implemented ingestion mutation in frontend with loading states
    - Ingestion now starts asynchronously and returns 202 Accepted
  - Files: server/scripts/ingest-huggingface-dataset.ts, server/controllers/adminController.ts, server/routes.ts, client/src/pages/HuggingFaceIngestion.tsx

### Added
- **ARC2 Research Paper Link** (Landing Page Enhancement)
  - Added prominent card on PuzzleBrowser landing page linking to ARC2 paper (https://www.arxiv.org/pdf/2505.11831)
  - Gradient purple-to-blue background for visual distinction
  - Responsive layout with BookOpen and ExternalLink icons
  - Positioned strategically below mission statement in hero section

- **About Page** (`/about`)
  - Comprehensive project information and background
  - Accessibility focus section explaining colorblindness support and emoji usage
  - Technology stack details and open source information
  - Acknowledgments for François Chollet, ARC Prize team, open source community, and users
  - Contact section with GitHub repository and issues links
  - Navigation integration with Info icon in AppNavigation
  - Fully responsive design using shadcn/ui components (Card, Button, Badge)


- **Admin Hub Dashboard** (`/admin`)
  - Centralized admin interface for all administrative operations
  - Quick stats: total models, total explanations, database status, last ingestion
  - Navigation cards to Model Management and HuggingFace Ingestion
  - Recent activity feed showing last 10 ingestion runs
  - Real-time database connection monitoring with health indicators
  - Backend API: `/api/admin/quick-stats`, `/api/admin/recent-activity`
  - Uses shadcn/ui: Card, Button, Badge, Separator, Alert

- **HuggingFace Ingestion UI** (`/admin/ingest-hf`)
  - Full-featured web interface for importing external model predictions
  - Configuration form with preset HuggingFace URLs (arcprize v1/v2 eval/training)
  - Auto-detection of ARC source from dataset URLs
  - Pre-flight validation with detailed checks:
    - URL accessibility verification
    - HF_TOKEN environment variable check
    - Database connection test
    - Sample puzzle data preview
  - Ingestion history table with sortable columns
  - Dry run mode for testing without database writes
  - Support for force overwrite and verbose logging options
  - Puzzle limit option for testing (process subset of puzzles)
  - Backend API: `/api/admin/validate-ingestion`, `/api/admin/ingestion-history`
  - Uses shadcn/ui: Card, Input, Select, Button, Checkbox, Alert, Dialog, Table, Tabs, Badge
  - Note: Actual ingestion execution (SSE streaming) prepared but requires user testing

- **Ingestion Runs Database Table** (`ingestion_runs`)
  - Tracks complete history of HuggingFace dataset ingestion operations
  - Stores: dataset name, base URL, source, total puzzles, success/fail/skip counts
  - Records: duration, accuracy percentage, dry run mode, error logs
  - Indexed by dataset name and started timestamp for efficient querying
  - Migration: Integrated into `DatabaseSchema.ts` as `createIngestionRunsTable()`
  - Auto-creates on server startup via schema initialization

- **Admin API Endpoints**
  - `GET /api/admin/quick-stats` - Dashboard statistics (models, explanations, DB status)
  - `GET /api/admin/recent-activity` - Last 10 ingestion runs for activity feed
  - `POST /api/admin/validate-ingestion` - Pre-flight validation before ingestion
  - `GET /api/admin/ingestion-history` - Complete ingestion run history
  - All endpoints include graceful handling of missing database/tables

- **Admin Routes Reorganization**
  - `/admin` → Admin Hub (new dashboard)
  - `/admin/models` → Model Management (relocated from `/model-config`)
  - `/admin/ingest-hf` → HuggingFace Ingestion UI (new)
  - `/model-config` → Preserved for backward compatibility

### Technical Details
- **SRP Compliance**: Each page has single responsibility (dashboard, model config, ingestion)
- **DRY**: Reuses existing services (PuzzleLoader, repositoryService, responseValidator)
- **shadcn/ui**: 100% shadcn/ui components, no custom UI
- **Data Mapping**: Applies same critical fixes from CLI ingestion script:
  - Uses `datasetName` for model name (not metadata.model)
  - Stores actual HF predictions in `predicted_output_grid`
  - Maps `content` → `pattern_description`
  - Maps `reasoning_summary` → `reasoning_log`
  - Maps `total_cost` → `estimated_cost`

### Changed
- Model Management moved from `/model-config` to `/admin/models` (backward compatible)
- Admin controller extended with ingestion endpoints (preserves existing recovery endpoint)

### Notes
- Database migration must be run: Execute `server/migrations/001_create_ingestion_runs.sql`
- Actual ingestion execution with SSE streaming is prepared but awaits user testing
- All new code follows established patterns and architectural principles