---
# PuzzleDiscussion Page Implementation Plan

## Purpose
Create a new PuzzleDiscussion page that enables multiple LLMs to collaboratively review puzzles with poor initial model feedback and attempt to solve them through a structured discussion. The feature draws on existing UI components, server APIs, and database records.

## High-Level Flow
1. User navigates to PuzzleDiscussion.
2. Page lists puzzles ranked by worst feedback / trustworthiness score.
3. User selects a puzzle → shows puzzle viewer, original model prediction & explanation.
4. User selects a reviewing LLM (e.g., o1/o3) and triggers “Review & Re-solve”.
5. Frontend sends POST `/api/discussion` with puzzle details + original analysis.
6. Backend builds prompt (include prediction grid, incorrect flag, reasoning items, scores) via `promptBuilder` and streams new LLM response.
7. UI displays chat-style exchange between original explanation and reviewing model; shows final answer & accuracy.

## Task Breakdown
### 1. Frontend
- Create `PuzzleDiscussion.tsx` page using routing conventions.
- Reuse components:
  - `PuzzleViewer` to render puzzle grid/tests.
  - `AnalysisResultCard` to show original model output.
  - `ModelButton` list for selecting reviewer LLM.
- Add list view similar to `PuzzleBrowser` filtered by low `prediction_accuracy_score`.
- Implement chat panel UI (simple flex column, bubble styling) for discussion exchange.
- Integrate with new backend endpoint via React Query mutation; handle streaming.

### 2. Backend
- Add `POST /api/discussion` route in `explanationController`.
- Use validation middleware to ensure required IDs.
- Retrieve original explanation & puzzle data via repositories.
- Leverage `promptBuilder.buildDiscussionPrompt()` (new helper) to format prompt including:
  - puzzle grid(s) (exclude correct answer).
  - original `predicted_output_grid`, `is_prediction_correct`, confidence, trustworthiness score.
  - reasoning fields (`pattern_description`, `solving_strategy`, `hints`).
- Call selected reviewer model via existing `explanationService` flow but mark `discussion=true` in DB.

### 3. Database
- No schema change; reuse `explanations` table with new `discussion_of` FK (nullable) or extend existing `analysis_type` enum to `discussion`.
- Update repository interfaces to support inserting discussion rows.

### 4. Prompt Design Guidelines (for promptBuilder)
- Instruct reviewer LLM to:
  1. Critique original reasoning.
  2. Provide its own reasoning (≤200 words).
  3. Output final predicted grid only.
- Supply trustworthiness context so LLM knows predecessor was wrong.

### 5. Testing & QA
- Unit tests: promptBuilder format, controller validation.
- Integration: simulate discussion flow with mock model.
- Frontend e2e: Cypress test selecting puzzle and reviewing.

### 6. Deployment Checklist
- Confirm environment variables for reviewer models present.
- Update documentation & changelog.

## Acceptance Criteria
- Page lists at least 20 worst-scoring puzzles sorted correctly.
- User can start discussion, see streaming chat, and final answer.
- New discussion explanations stored with reference to original run.
- Prompt includes all specified fields and length constraints.
- Code follows project style and passes `npm run test`.

---
