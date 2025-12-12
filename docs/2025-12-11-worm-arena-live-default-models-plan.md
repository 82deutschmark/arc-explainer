# 2025-12-11 – Worm Arena Live default models (GPT-5 mini/nano first)

Author: GPT-5.1 Codex CLI  
Date: 2025-12-11  
Scope: Worm Arena Live (`client/src/pages/WormArenaLive.tsx`, `client/src/components/WormArenaSetup.tsx`) default model selection and opponent presets.

## Goal
Make Worm Arena Live default to GPT-5 family (mini and nano preferred) plus Grok 4.1 fast, both for Model A and the auto-filled opponent list, without breaking existing selection or provider mappings.

## Target defaults (priority order)
1) `openai/gpt-5.1-codex-mini` (maps from `openrouter/gpt-5.1-codex-mini`)  
2) `openai/gpt-5-mini`  
3) `openai/gpt-5-nano`  
4) `openai/gpt-5.1`  
5) `openai/gpt-5.2`  
6) `x-ai/grok-4.1-fast`  
7) Any other models (current selectable list order) as fallback

If a higher-priority model is missing/disabled, fall through to the next available. Never allow self-play; opponents should be drawn from the same priority list excluding Model A.

## Plan
1) Inspect `useModels` output + `getSnakeEligibleModels` to confirm available IDs align with OpenRouter keys (noting the existing map from `openrouter/gpt-5.1-codex-mini` → `openai/gpt-5.1-codex-mini`).
2) Add a shared priority helper in `WormArenaLive.tsx` to sort `selectableModels` according to the target list and produce:
   - Preferred Model A (first available in priority order).
   - Preferred opponent list (top N after removing Model A, capped at 9/10 as today).
3) Update the initial effects:
   - Model A: set from priority helper instead of current Grok-first default.
   - Opponents: seed from prioritized list rather than raw `selectableModels.slice(0, 9)`.
4) Update `WormArenaSetup` “Reset to Top 9” to reuse the same prioritized list (passed in props) so manual reset matches the new defaults.
5) Keep backward compatibility:
   - Preserve `mapToSnakeBenchModelId` for codex-mini.
   - Do not alter BYO provider/key logic.
6) Document the change in `CHANGELOG.md` and add brief inline comments for priority helper.

## Validation
- With a full model catalog containing GPT-5 mini/nano and Grok 4.1 fast:
  - Model A auto-selects the highest available priority (mini, then nano, etc.).
  - Opponents auto-fill with the next priority models (no duplicates, no self-play).
  - “Reset to Top 9” matches the prioritized ordering.
- With missing GPT-5 mini/nano entries:
  - Fallback picks the next available priority (e.g., gpt-5.1 or grok-4.1-fast).
- Manual selections remain untouched once the user changes them.
