# 2025-11-29 Poetiq Prompt-Style Selector Plan

## Goal
Allow Poetiq runs to choose between the existing "classic" solver prompt and the cleaned-up ARC Poetiq prompt before a run, and ensure this choice flows end-to-end from the UI to the Python solver prompts.

## Scope
- Frontend: PoetiqSolver page + PoetiqControlPanel.
- Hook: usePoetiqProgress.
- Backend: poetiqController + poetiqService.
- Python: poetiq_wrapper + solver/poetiq/prompts.
- Docs: Changelog entry for the feature.

## Prompt Styles
- `classic` (default):
  - Uses current `SOLVER_PROMPT_1` + `FEEDBACK_PROMPT` behavior.
  - Preserves compatibility with historical Poetiq behavior.
- `arc` (ARC-optimized):
  - Uses a new ARC-specific solver prompt derived from `docs/ARC_Poetiq_Prompt.md`.
  - Assumes standard Python/NumPy knowledge, no inlined boilerplate examples.
  - Treats prior attempts as short English summaries with scores/reasons.

## Implementation Steps

1. **Type & Option Plumbing**
   - Extend `PoetiqOptions` (frontend hook) with:
     - `promptStyle?: 'classic' | 'arc';`
   - Extend `PoetiqOptions` (Node service) with the same union.
   - Ensure the option is serialized into the JSON body sent to `/api/poetiq/solve/:taskId` and forwarded unchanged into the Python `options` blob.

2. **UI: PoetiqControlPanel Selector**
   - In `PoetiqControlPanel.tsx`:
     - Add props: `promptStyle`, `setPromptStyle` with type `'classic' | 'arc'`.
     - Render a compact `Select` titled "Prompt Template" with two choices:
       - "Classic Poetiq (original prompt)" → `classic`.
       - "ARC Explainer (cleaned ARC prompt)" → `arc`.
     - Disable the control while a run is active.
   - In `PoetiqSolver.tsx`:
     - Add local state: `const [promptStyle, setPromptStyle] = useState<'classic' | 'arc'>('classic');`.
     - Pass `promptStyle` + setter into `PoetiqControlPanel`.
     - Include `promptStyle` in `start({...})` both for manual runs and Community auto-start handoff.

3. **Backend: Controller + Service**
   - `poetiqController.solve`:
     - Read `promptStyle` from `req.body` (validate as `'classic' | 'arc' | undefined`).
     - Add `promptStyle` to the `options` object passed to `poetiqService.solvePuzzle` and to the initial WebSocket config broadcast.
   - `poetiqService.solvePuzzle`:
     - Extend `PoetiqOptions` with `promptStyle?: 'classic' | 'arc';`.
     - Ensure `promptStyle` is preserved when building the payload for the Python child (`options` in stdin payload).

4. **Python: Wrapper + Prompts**
   - `solver/poetiq/prompts.py`:
     - Keep existing `SOLVER_PROMPT_1` and `FEEDBACK_PROMPT` as the **classic** prompt set.
     - Add new constants:
       - `SOLVER_PROMPT_ARC` – ported from `docs/ARC_Poetiq_Prompt.md` (with a `$$problem$$` placeholder in the right spot).
       - `FEEDBACK_PROMPT_ARC` – aligned with the "EXISTING PARTIAL/INCORRECT SOLUTIONS" section from the ARC doc using summarized attempts instead of raw code.
   - `server/python/poetiq_wrapper.py`:
     - Update `build_config_list(...)` signature to accept `prompt_style: str | None = None`.
     - Import new prompts: `from solver.poetiq.prompts import SOLVER_PROMPT_1, SOLVER_PROMPT_ARC, FEEDBACK_PROMPT, FEEDBACK_PROMPT_ARC`.
     - Inside `build_config_list`, choose prompts based on `prompt_style`:
       - If `prompt_style == 'arc'`: use ARC solver/feedback prompts.
       - Else (default): use classic prompts.
     - In `run_poetiq_solver`, read `prompt_style = options.get('promptStyle')` from the incoming JSON and pass it to `build_config_list`.

5. **Safety & Defaults**
   - Default behavior (**no `promptStyle` provided**) remains the classic prompt to avoid surprising existing integrations.
   - The new ARC prompt is only used when the user explicitly selects it in the UI (or via Community handoff).

6. **Docs: Changelog**
   - Add a `5.33.12` entry at the top of `CHANGELOG.md`:
     - Title: Poetiq Prompt-Style Selector (Classic vs ARC).
     - Note that the runtime now supports two prompt templates and that the ARC option reuses the cleaned `ARC_Poetiq_Prompt` contract.
     - List touched files at a high level.

## Test Plan

- **Smoke test: Classic prompt (default)**
  - Start a Poetiq run without touching the prompt selector.
  - Verify in the Prompt Inspector that the system prompt matches the existing classic text (with examples).
  - Confirm runs complete as before.

- **Smoke test: ARC prompt**
  - Select "ARC Explainer" in the Prompt Template selector and start a run.
  - Confirm the system prompt now matches the ARC doc wording (no embedded Python examples, English summaries for previous attempts).
  - Ensure progress events and cost tracking still flow correctly.

- **Regression guard**
  - Run one short puzzle with each prompt style and ensure no crashes in the Python wrapper, no JSON errors, and successful WebSocket updates.
