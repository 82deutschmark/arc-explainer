## Goal

Enforce "Bring Your Own Key" (BYO Key) for the **Poetiq solver only**. Users must provide their own API key per session to run Poetiq. No fallback to server/project-level keys.

## Scope

- **Poetiq solver only** — other pages (PuzzleExaminer, Saturn, etc.) are unaffected
- **Session-only** — keys are entered per-session, never stored persistently (safest approach)
- **Clear UX** — explicit "Bring Your Own Key" labeling so users understand what's happening

## Non-Goals

- Do not create a global settings/API key management page
- Do not persist user keys to database
- Do not change other solvers or analysis flows

## Implementation Plan

### Backend Changes (poetiqController.ts)

1. Add validation in `solve()` endpoint:
   - If `apiKey` is missing or empty → return 400 with `api_key_required` error code
   - Remove "usingFallback" logic entirely
   - Keep batch endpoint unchanged (server-side automation uses env vars)

### Backend Changes (poetiqService.ts)

1. Remove fallback messaging in `solvePuzzle()`:
   - Delete the log about "using server OPENAI_API_KEY"
   - Key is now always provided by caller

### Frontend Changes (PoetiqControlPanel.tsx)

1. Rename the key field to "Bring Your Own Key"
2. Make it visually required (not optional)
3. Add helper text explaining:
   - "Your key is used for this session only and never stored"
   - Link to get keys from each provider
4. Disable "Start" button if key is empty

### Frontend Changes (PoetiqSolver.tsx)

1. Handle `api_key_required` error from backend
2. Show clear message directing user to enter their key

## Testing

- **Backend**
  - Unit tests for key resolution helpers:
    - With a valid user key → request succeeds and uses user key only.
    - Without a user key → returns "key required" error; never falls back to project key.
    - With invalid/expired keys → returns appropriate error without leaking details.
  - Controller tests:
    - For each user-facing endpoint that calls Gemini/OpenRouter (and similar):
      - Assert that missing keys produce the normalized "API key required" error response.
- **Frontend**
  - Component / integration tests:
    - Simulate "API key required" backend error and confirm:
      - Correct message and CTA to open settings.
      - Flow works from key entry to successful retry.
  - Manual smoke tests:
    - Existing user with keys: run flows for each provider and confirm unchanged behavior.
    - New user without keys: try to run a model; confirm:
      - Error is clear.
      - Settings link works.
      - After adding the key, the same action succeeds.

## Documentation

- Update `docs/reference/api/ResponsesAPI.md` and any relevant provider-specific docs to:
  - State that user API keys are required for Gemini/OpenRouter (and any similar providers) in user-facing flows.
  - Clarify that project-level keys are reserved for system tasks and are not a fallback for end-user runs.
- Add a short note to any onboarding or setup docs explaining:
  - Where to enter keys.
  - Which features require them.

