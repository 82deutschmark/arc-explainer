# 2025-11-28 Poetiq Community Solver Fix Plan

## Goal
Restore the Poetiq Community page "Start Solver" flow and remove provider/model ambiguity so community auditors can reliably jump into the Poetiq solver with clear routing expectations.

## Target Files
- `client/src/pages/PoetiqCommunity.tsx` — fix runtime crash, load models dynamically, clarify provider routing, and ensure navigation works.
- `client/src/hooks/usePoetiqModels.ts` — expose routing/BYO metadata so the community page can render accurate provider badges.
- `docs/CHANGELOG.md` — capture the fix with semantic version bump.

## Tasks
1. **Stop the white-page crash**
   - Import any missing UI primitives (Badge) and guard optional sections so toggling "Start Solver" never throws.

2. **Single source of truth for model options**
   - Replace the hardcoded `POETIQ_MODELS` array with the `usePoetiqModels` hook.
   - Map server-provided `provider`/`routing` metadata into clear dropdown labels and hints (e.g., "OpenRouter → Gemini 3 Pro" vs "Google Direct → Gemini 3 Pro").
   - Persist both the LiteLLM model id and normalized provider slug to `sessionStorage` before navigation.

3. **Provider clarity in the UI**
   - Update the settings card to show a badge for either `Direct API` or `OpenRouter Relay` plus the vendor name.
   - Expand the API key helper text so users immediately know which console link they need.

4. **Verification**
   - Manual smoke test: load `/poetiq`, toggle Start Solver, confirm the dropdown renders with grouped providers and provider badges update when switching models.
   - Click "Run Solver" to ensure navigation takes you to `/puzzle/poetiq/<puzzleId>` without runtime errors.

## Notes
- Keep messaging jargon-free (user is a hobbyist executive).
- Preserve existing styling choices but add concise comments where logic becomes non-trivial.
