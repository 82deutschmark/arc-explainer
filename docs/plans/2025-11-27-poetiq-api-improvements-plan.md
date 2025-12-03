/**
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-27
 * PURPOSE: Plan for improving Poetiq Solver's API integration - adding prompt visibility,
 *          direct OpenAI Responses API support, and correct reasoning parameters.
 * SRP/DRY check: Pass - planning document only
 */

# Poetiq API Improvements Plan

## Problem Statement

The user identified several critical issues with the Poetiq Solver integration:

1. **No Prompt Visibility** - Users cannot see what's being sent to the AI (system prompt, user prompt)
2. **Using Wrong API** - Poetiq uses litellm's ChatCompletions API for ALL calls, even direct OpenAI models
3. **Routing Confusion** - Users don't know if calls go to OpenAI directly or through OpenRouter
4. **Wrong Reasoning Settings** - GPT-5.1 Codex Mini should use `summary: "detailed"` and `verbosity: "high"`

## Current Architecture

```
User → PoetiqSolver.tsx → poetiqController.ts → poetiqService.ts → poetiq_wrapper.py
                                                                           ↓
                                                              solver/poetiq/llm.py
                                                                           ↓
                                                              litellm.acompletion() ← ChatCompletions API!
```

**Problem**: Even for `gpt-5.1-codex-mini` (marked as direct OpenAI), all calls go through litellm.

## Target Architecture

```
User → PoetiqSolver.tsx → poetiqController.ts → poetiqService.ts 
                                                        ↓
                              ┌─────────────────────────┴─────────────────────────┐
                              ↓                                                   ↓
                   [Direct OpenAI Models]                              [Other Models]
                              ↓                                                   ↓
                   OpenAI Responses API                                poetiq_wrapper.py
                   (server/services/openai)                            → litellm (ChatCompletions)
```

## Implementation Plan

### Phase 1: Prompt Visibility (CRITICAL)

**Goal**: Show users exactly what prompts are being sent.

#### 1.1 Add Prompts to WebSocket Events

Modify `poetiq_wrapper.py` to emit prompts in progress events:

```python
# In instrumented_solve_coding(), before calling llm():
emit({
    "type": "progress",
    "phase": "prompting",
    "iteration": it + 1,
    "expert": expert_id,
    "message": f"Expert {expert_id}: Sending prompt to {llm_model}...",
    "promptData": {
        "systemPrompt": solver_prompt,  # From config
        "userPrompt": message,          # Built prompt with problem description
        "model": llm_model,
        "temperature": solver_temperature,
        "provider": "litellm" if "openrouter" in llm_model else "direct"
    }
})
```

#### 1.2 Add Prompt Display to Frontend

Add a collapsible "Prompts" section in `PoetiqSolver.tsx`:

- System Prompt (read-only, from SOLVER_PROMPT_1)
- User Prompt (dynamic, includes puzzle data)
- Full Request/Response log

### Phase 2: Direct OpenAI Responses API for OpenAI Models

**Goal**: When using OpenAI models directly, bypass litellm and use our proper Responses API client.

#### 2.1 Model Detection

In `poetiq_wrapper.py`, detect if model should use direct OpenAI:

```python
DIRECT_OPENAI_MODELS = {
    'gpt-5.1-codex-mini',
    'gpt-5-mini-2025-08-07',
    'gpt-5-nano-2025-08-07',
    'gpt-5-2025-08-07',
    'o3-mini-2025-01-31',
    'o4-mini-2025-04-16',
}

def should_use_direct_openai(model_id: str) -> bool:
    normalized = model_id.lower().replace('openai/', '')
    return any(direct in normalized for direct in DIRECT_OPENAI_MODELS)
```

#### 2.2 Create Direct OpenAI Call Function

Option A: Add OpenAI SDK call directly in Python wrapper
Option B: Route through existing TypeScript OpenAI service via HTTP callback

**Recommendation**: Option A is simpler and maintains the single Python process.

```python
import openai

async def llm_openai_responses(
    model: str,
    message: str,
    system_prompt: str,
    temperature: float,
    reasoning_effort: str = "high",
    verbosity: str = "high",
    reasoning_summary: str = "detailed",
) -> tuple[str, dict]:
    """
    Call OpenAI via Responses API (POST /v1/responses).
    Uses proper reasoning parameters for GPT-5.x models.
    """
    client = openai.AsyncOpenAI()
    
    response = await client.responses.create(
        model=model,
        input=[{"role": "user", "content": message}],
        instructions=system_prompt,
        reasoning={
            "effort": reasoning_effort,
            "summary": reasoning_summary,  # "detailed" not "auto"
        },
        text={
            "verbosity": verbosity,  # "high"
        },
        max_output_tokens=128000,
        store=True,
    )
    
    # Extract text from response.output[]
    output_text = ""
    for item in response.output:
        if item.type == "message":
            for content in item.content:
                if content.type == "output_text":
                    output_text += content.text
    
    token_usage = {
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens,
        "total_tokens": response.usage.total_tokens,
        "reasoning_tokens": getattr(response.usage.output_tokens_details, 'reasoning_tokens', 0),
    }
    
    return output_text, token_usage
```

### Phase 3: Reasoning Parameters for GPT-5.1 Codex Mini

**Goal**: Ensure GPT-5.1 Codex Mini uses:
- `reasoning.summary = "detailed"` (not "auto")
- `reasoning.effort = "high"`
- `text.verbosity = "high"`

This is already partially done in `poetiq_wrapper.py` lines 266-271:

```python
if "gpt-5" in model_lower or "o3" in model_lower or "gpt5" in model_lower:
    llm_kwargs["verbosity"] = "high"
    llm_kwargs["reasoning_summary"] = "detailed"
```

But these kwargs are passed to litellm which doesn't use them properly. With Phase 2, these will be properly applied via the Responses API.

### Phase 4: Provider Indicator in UI

**Goal**: Show users clearly which provider/API is being used.

#### 4.1 Add Provider Badge

In the header or control bar of `PoetiqSolver.tsx`:

```tsx
{/* Provider Badge */}
<div className="flex items-center gap-2 px-3 py-1.5 rounded bg-white/10">
  {isDirectOpenAI ? (
    <span className="text-green-400 font-bold">🔗 Direct OpenAI</span>
  ) : (
    <span className="text-amber-400">🔀 OpenRouter (litellm)</span>
  )}
</div>
```

#### 4.2 Add API Info to Config Display

Show in the initial config section:
- Provider: OpenAI / Anthropic / Gemini / OpenRouter
- API Type: Responses API / ChatCompletions API
- Reasoning: Enabled with {effort} / Disabled

## Files to Modify

1. **`server/python/poetiq_wrapper.py`**
   - Add prompt emission to progress events
   - Add direct OpenAI Responses API call function
   - Add model routing logic

2. **`solver/poetiq/llm.py`**
   - Keep as-is for OpenRouter/litellm models
   - Export types for compatibility

3. **`client/src/pages/PoetiqSolver.tsx`**
   - Add Prompts display section
   - Add Provider indicator badge
   - Add API info to config display

4. **`client/src/hooks/usePoetiqProgress.ts`**
   - Add `promptData` to state interface
   - Handle `prompting` phase events

5. **`client/src/components/poetiq/PoetiqPromptDisplay.tsx`** (NEW)
   - Reusable component for displaying prompts
   - Collapsible sections for system/user prompts
   - Copy button functionality

## Acceptance Criteria

1. ✅ User can see the system prompt being used
2. ✅ User can see the user prompt (with puzzle data)
3. ✅ User knows if call is going to OpenAI directly or via OpenRouter
4. ✅ GPT-5.1 Codex Mini uses Responses API with correct reasoning params
5. ✅ Provider badge clearly indicates routing
6. ✅ All changes documented in CHANGELOG.md

## Risks & Mitigations

1. **Risk**: OpenAI SDK version mismatch in Python
   - **Mitigation**: Add `openai>=1.50.0` to requirements.txt (already present)

2. **Risk**: Breaking existing litellm flow
   - **Mitigation**: Keep litellm path as fallback; only route specific models to direct API

3. **Risk**: Token tracking differences between APIs
   - **Mitigation**: Normalize token response format in both paths

## Timeline

- Phase 1 (Prompt Visibility): ~1 hour
- Phase 2 (Direct OpenAI): ~2 hours
- Phase 3 (Reasoning Params): Included in Phase 2
- Phase 4 (UI Indicators): ~30 minutes
- Testing & Verification: ~30 minutes

Total: ~4 hours
