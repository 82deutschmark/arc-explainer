---
description: Internalize Poetiq solver, remove litellm dependency, follow Saturn pattern
---

# Poetiq Solver Internalization Plan

**Date:** 2025-11-27  
**Author:** Cascade (Claude Sonnet 4)  
**Goal:** Move Poetiq solver from git submodule into `solver/poetiq/`, replace litellm with direct Google Generative AI SDK, and gain token tracking capabilities.

## 1. Current State (Problem)

- Poetiq lives in `poetiq-solver/` git submodule
- Uses `litellm` for API calls (unnecessary abstraction)
- No token/cost tracking (litellm returns this but code ignores it)
- Inconsistent with Saturn/Grover patterns

## 2. Target State (Solution)

- Poetiq code in `solver/poetiq/` (internalized)
- Direct `google-generativeai` SDK calls (like Saturn uses OpenAI SDK)
- Token tracking returned from solver
- Wrapper imports from `solver/poetiq` not submodule

## 3. Files to Create/Modify

### New Files (in `solver/poetiq/`)

| File | Source | Notes |
|------|--------|-------|
| `solver/poetiq/__init__.py` | New | Package init |
| `solver/poetiq/llm.py` | Replace `arc_agi/llm.py` | Direct google-generativeai SDK |
| `solver/poetiq/config.py` | Copy `arc_agi/config.py` | Minor modifications |
| `solver/poetiq/prompts.py` | Copy `arc_agi/prompts.py` | No changes |
| `solver/poetiq/solve.py` | Copy `arc_agi/solve.py` | Update imports |
| `solver/poetiq/solve_coding.py` | Copy `arc_agi/solve_coding.py` | Update imports |
| `solver/poetiq/solve_parallel_coding.py` | Copy `arc_agi/solve_parallel_coding.py` | Update imports |
| `solver/poetiq/sandbox.py` | Copy `arc_agi/sandbox.py` | No changes |
| `solver/poetiq/scoring.py` | Copy `arc_agi/scoring.py` | No changes |
| `solver/poetiq/io.py` | Copy `arc_agi/io.py` | No changes |
| `solver/poetiq/types.py` | Copy `arc_agi/types.py` | No changes |
| `solver/poetiq/utils.py` | Copy `arc_agi/utils.py` | No changes |

### Modified Files

| File | Change |
|------|--------|
| `server/python/poetiq_wrapper.py` | Import from `solver.poetiq` instead of `poetiq-solver` |
| `solver/requirements.txt` or project `requirements.txt` | Add `google-generativeai`, remove `litellm` |

## 4. Implementation Steps

### Phase 1: Create solver/poetiq directory structure
- [x] Create `solver/poetiq/` directory
- [x] Create `__init__.py`

### Phase 2: Copy and adapt core files (no LLM changes yet)
- [x] Copy `types.py`, `utils.py`, `prompts.py` (unchanged)
- [x] Copy `sandbox.py`, `scoring.py`, `io.py` (unchanged)
- [x] Copy `config.py` (update imports)
- [x] Copy `solve_coding.py` (update imports)
- [x] Copy `solve_parallel_coding.py` (update imports)
- [x] Copy `solve.py` (update imports)

### Phase 3: Replace llm.py with direct Google SDK
- [x] Create new `llm.py` using `google-generativeai`
- [x] Maintain same function signature for compatibility
- [x] Add token usage tracking to return value
- [x] Handle rate limiting with asynciolimiter (keep this)

### Phase 4: Update wrapper
- [x] Update `server/python/poetiq_wrapper.py` to import from `solver.poetiq`
- [x] Update token/cost data flow to surface in results

### Phase 5: Testing & Cleanup
- [ ] Test with Gemini 3 Pro Preview
- [ ] Verify token counts are captured
- [x] Document in CHANGELOG.md
- [ ] (Future) Remove poetiq-solver submodule

## 5. Key Technical Details

### New llm.py Signature (must match existing)

```python
async def llm(
    model: str,
    message: str,
    temperature: float,
    request_timeout: int | None,
    max_remaining_time: float | None,
    max_remaining_timeouts: int | None,
    problem_id: str | None = None,
    retries: int = 3,
    **kwargs,
) -> tuple[str, float, float | None, int | None, dict]:
    # Returns: (response_text, duration, remaining_time, remaining_timeouts, token_usage)
```

### Google Generative AI SDK Usage

```python
import google.generativeai as genai

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

model = genai.GenerativeModel("gemini-3-pro-preview")
response = await model.generate_content_async(
    message,
    generation_config={"temperature": temperature}
)

# Token tracking available:
# response.usage_metadata.prompt_token_count
# response.usage_metadata.candidates_token_count
# response.usage_metadata.total_token_count
```

## 6. Dependencies

**Add:**
- `google-generativeai>=0.8.0`

**Keep:**
- `asynciolimiter` (rate limiting)
- `numpy` (grid operations)

**Remove (from poetiq context):**
- `litellm`

## 7. Verification

- [ ] Poetiq solver runs without errors
- [ ] Token counts appear in solver output
- [ ] Results match previous litellm-based runs
- [ ] No import errors from old submodule path
