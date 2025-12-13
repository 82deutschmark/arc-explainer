## 2025-12-12 Worm Arena Responses Plan

### Goal
Ensure Worm Arena matches always call OpenAI's Responses API when using OpenAI models and avoid the OpenRouter chat fallback that returns non-JSON payloads (which currently triggers the random-move error).

### Files targeted
- `server/python/snakebench_runner.py` – steer the runner to select the correct provider/api_type and document the required inputs.
- `external/SnakeBench/backend/llm_providers.py` – align OpenRouter/OpenAI provider implementations with Responses input/output expectations and add clearer errors around unexpected responses.
- `server/services/snakeBenchService.ts` – confirm the environment + model config ensures OpenAI models hit the direct OpenAI provider and verify parsing logic tolerates stray log lines.
- `CHANGELOG.md` (top) – note the fix and the files touched for traceability.

### Todos
1. Document the new Responses-centric workflow, capturing expected inputs that the Python runner will send to the provider helper.
2. Update the provider helper to construct `input` arrays and extract text/usage from Responses output, including handling partial or text-wrapped payloads.
3. Tighten the error messaging when a provider returns unexpected text so the parser can warn instead of crashing.
4. Add tests or manual verification steps (run a short match) to confirm streaming output is stable with `openai/gpt-5-nano`.
5. Record the change in `CHANGELOG.md` (head) with the standard semantic version bump and summary.
