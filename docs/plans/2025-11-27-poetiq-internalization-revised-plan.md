# Poetiq Internalization - Revised Plan

**Author:** Cascade (Claude Sonnet 4)  
**Date:** 2025-11-27  
**Status:** Revised - Previous approach was incorrect

## Problem Analysis

### What Was Wrong With My First Approach
I replaced litellm with direct Google SDK calls. This was **incorrect** because:
1. It breaks faithful replication of Poetiq's original behavior
2. litellm already provides all the data we need - Poetiq just throws it away!
3. The user wants to audit Poetiq accurately, not replace its architecture

### The Real Problem
Looking at `poetiq-solver/arc_agi/llm.py` lines 96-101:
```python
return (
    resp["choices"][0]["message"]["content"].strip(),  # Only extracts text!
    duration,
    max_remaining_time,
    max_remaining_timeouts,
)
# resp.usage is AVAILABLE but NEVER RETURNED!
```

**litellm DOES provide token usage** - it returns:
- `response.usage.prompt_tokens`
- `response.usage.completion_tokens`  
- `response.usage.total_tokens`

Poetiq simply discards this data.

### How Saturn Differs
Saturn uses the OpenAI SDK directly (`from openai import OpenAI`) and captures everything
from the API response. It's tightly coupled to OpenAI.

Poetiq uses litellm for multi-provider support, which is **actually a good design** - 
but it fails to capture the telemetry data litellm provides.

## Correct Solution

### 1. Keep litellm (faithful to Poetiq)
litellm handles:
- Provider routing (Gemini, OpenAI, Anthropic, xAI, OpenRouter)
- API key management
- Model property passing (reasoning_effort, thinking config, etc.)

### 2. Install all required SDK backends
litellm needs these packages to route to each provider:
- `google-generativeai` - for Gemini models
- `openai` - for OpenAI/GPT models  
- `anthropic` - for Claude models
- `litellm` - the router itself
- `asynciolimiter` - rate limiting (kept from original)

### 3. FIX the data capture
The internalized `llm.py` should extract ALL data from litellm responses:
```python
async def llm(...) -> tuple[str, float, float | None, int | None, dict]:
    # ... existing logic ...
    resp = await acompletion(...)
    
    # Extract token usage (THIS IS THE FIX!)
    usage = {}
    if hasattr(resp, 'usage') and resp.usage:
        usage = {
            "prompt_tokens": getattr(resp.usage, 'prompt_tokens', 0) or 0,
            "completion_tokens": getattr(resp.usage, 'completion_tokens', 0) or 0,
            "total_tokens": getattr(resp.usage, 'total_tokens', 0) or 0,
        }
    
    return (
        resp["choices"][0]["message"]["content"].strip(),
        duration,
        max_remaining_time,
        max_remaining_timeouts,
        usage,  # NEW: token usage data
    )
```

### 4. Propagate usage through the solver chain
- `solve_coding.py` - accumulate token usage across iterations
- `solve_parallel_coding.py` - aggregate across experts
- Return in `ARCAGIResult` for cost analysis

## Implementation Checklist

### Phase 1: Fix requirements.txt
- [x] Keep `litellm` 
- [x] Add `google-generativeai>=0.8.0`
- [x] Add `openai>=1.0.0`
- [x] Add `anthropic>=0.40.0`
- [x] Keep `asynciolimiter`
- [x] Keep `numpy`, `scipy`

### Phase 2: Fix solver/poetiq/llm.py
- [x] Restore litellm-based implementation
- [x] Add token usage extraction from `resp.usage`
- [x] Return usage dict as 5th element of tuple

### Phase 3: Update solve_coding.py
- [x] Accumulate token usage across iterations
- [x] Attach to ARCAGIResult

### Phase 4: Update types.py
- [x] Add TokenUsage TypedDict (already done)

### Phase 5: Test
- [ ] Verify litellm routes to Gemini correctly
- [ ] Verify token usage is captured and returned
- [ ] Verify faithful replication of original Poetiq behavior

## Benefits of This Approach

1. **Faithful Replication** - Uses litellm exactly like original Poetiq
2. **Data Capture** - Extracts token usage that was always available
3. **Multi-Provider** - Works with all providers Poetiq supports
4. **Minimal Changes** - Only adds data extraction, doesn't change architecture
5. **Cost Analysis** - Enables accurate cost tracking for auditing

## Comparison

| Aspect | My First Approach | Correct Approach |
|--------|-------------------|------------------|
| litellm | Removed | Kept |
| Provider routing | Manual (only Gemini) | litellm (all providers) |
| Token capture | New implementation | Extract from litellm |
| Faithful to Poetiq | No | Yes |
| Complexity | Higher | Lower |
