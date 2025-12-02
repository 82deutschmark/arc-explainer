# Streaming & Discussion Fixes Plan (2025-12-02)

## Goals
- Clarify and de-bias the streaming UI so it only shows real telemetry from the backend.
- Ensure the Discussion page reuses the same "previous prediction" context that Debate mode already passes into prompts.
- Keep Model Debate, Puzzle Discussion, and Puzzle Examiner behavior consistent where it matters (prompt wiring + streaming panel usage).

## Tasks
- [ ] Backend: Update `buildDiscussionUserPrompt` so it includes the model's prior predicted output grids (single- and multi-test), mirroring `buildDebateUserPrompt` semantics but with self-refinement wording.
- [ ] Frontend: Verify `PuzzleDiscussion` passes `originalExplanation`, `customChallenge` (user guidance), and `previousResponseId` into `useAnalysisResults` and `PromptPreviewModal` consistently.
- [ ] Frontend: Remove the synthetic "Solver Progress" chip row and friendly status line from `StreamingAnalysisPanel`, keeping only:
  - Live `phase` and `message` from the stream,
  - Real token usage numbers,
  - Prompt preview, task grids, and predicted grids derived from actual structured JSON.
- [ ] Frontend: Ensure all pages that use `StreamingAnalysisPanel` (PuzzleExaminer, ModelDebate, PuzzleDiscussion) still render correctly after the cleanup.
- [ ] Frontend (follow-up): Decide whether Debate/Discussion should use the full-screen modal pattern from Puzzle Examiner or keep inline panels; if we change this, update both pages together.
- [ ] Repo hygiene: Update `CHANGELOG.md` (top-appended, semantic version bump) describing:
  - Streaming panel UI cleanup (no hallucinated solver progress),
  - Discussion prompt fix to include prior predictions for refinement.

## Integration Notes
- Prompt construction flows through `promptBuilder.buildAnalysisPrompt` and `userTemplates.buildUserPromptForTemplate`:
  - `promptId === 'debate'` already uses `buildDebateUserPrompt`, which injects prior explanation text + predicted outputs.
  - `promptId === 'discussion'` currently uses `buildDiscussionUserPrompt`, which **does not** yet include predicted outputs.
- `PuzzleDiscussion` already forwards `originalExplanation`, `customChallenge` (user guidance), and `previousResponseId` into `useAnalysisResults` and `PromptPreviewModal`; after backend fixes, the same data will drive better prompts.
- Streaming UI is a shared primitive (`StreamingAnalysisPanel`) used by multiple pages; removing fake progress chips will immediately propagate everywhere without changing streaming behavior.
