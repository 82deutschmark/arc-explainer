## Goal

Enforce that users must provide their own API key for third-party model providers (e.g., Gemini, OpenRouter) instead of silently falling back to project-level keys, while preserving all existing flows and UX where keys are already configured.

## Non-Goals

- Do not change model selection, routing, or cost accounting logic.
- Do not introduce new providers or new UI surfaces beyond what already exists.
- Do not remove or weaken any existing security hardening around key storage or usage.

## Assumptions

- Backend already supports per-user API key storage and uses project-level keys only as a fallback.
- Existing security hardening (encryption, scoping, logging) for stored keys is in place and must not be relaxed.
- Current UI already has a place where users can enter and manage their API keys.

## High-Level Plan

1. Identify every place where project-level keys are used as a fallback for user API keys.
2. Replace silent fallback behavior with explicit "API key required" validation.
3. Update the frontend to clearly prompt for missing keys and guide the user to the settings screen.
4. Ensure existing users who already have keys configured see no behavioral changes.
5. Update docs and tests to reflect the new requirement.

## Backend Changes

- **Inventory key usage**
  - Scan configuration and services that interact with third-party providers (e.g., Gemini, OpenRouter) to find:
    - Any `getApiKey`/`resolveApiKey` helpers that fall back to project keys.
    - Any controller/service methods that default to project keys when user keys are absent.
- **Enforce "no fallback" policy**
  - For each provider:
    - Change resolution logic so that:
      - If user key exists and is valid → use it.
      - If user key is missing or invalid → fail fast with a clear, typed error (e.g., `UserApiKeyRequiredError`).
    - Ensure project-level keys are still allowed for:
      - Internal system jobs or background tasks that are not tied to a user session.
      - Explicitly whitelisted admin flows (if any), documented in code and docs.
- **Error surface & logging**
  - Normalize backend error shape so the frontend can reliably detect:
    - "User API key missing" vs. generic provider errors.
  - Make sure logs:
    - Never include raw keys.
    - Include enough metadata to debug (user ID, provider, timestamp).

## Frontend Changes

- **Unified "missing key" UX**
  - When backend returns a "user API key required" error:
    - Show a friendly, concise message explaining that a key is required for that provider.
    - Offer a direct link or button to open the existing API key/settings page.
  - Ensure this behavior is consistent across:
    - Any page that triggers provider calls (e.g., solver, playground, Poetiq-related flows if applicable).
- **Settings / API Key screen**
  - Confirm the existing screen:
    - Lets users add, edit, and remove provider-specific keys.
    - Explains which flows depend on each key (e.g., "Gemini models require your Gemini API key").
  - If needed, add short helper text clarifying:
    - Keys are kept private and only used for your own requests.
    - The app will no longer fall back to project keys for personal runs.

## Migration & Rollout

- **Soft-check in logs (optional pre-step)**
  - Before deploying the strict requirement, optionally add temporary logging to measure:
    - How often provider calls currently rely on project-level fallback.
  - Use this to estimate user impact and decide if additional onboarding messaging is needed.
- **Deployment behavior**
  - After the change:
    - Existing users with keys configured should see no change.
    - Users without keys will:
      - Receive an explicit error when they try to use a protected provider.
      - Be guided to the settings screen to add their key.
- **Backwards compatibility**
  - Keep project-level keys for:
    - System-level workflows.
    - Any explicitly documented admin or maintenance tools.
  - Document that user-facing flows now require user keys.

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

