"""
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-27
 * PURPOSE: LLM interface for Poetiq solver using litellm (faithful to original Poetiq).
 *          Enhanced to capture token usage data that was previously discarded.
 *          litellm handles multi-provider routing (Gemini, OpenAI, Anthropic, xAI, etc.)
 * SRP and DRY check: Pass - LLM interface only.
 * 
 * KEY FIX: Original Poetiq discarded resp.usage - we now capture and return it!
 * This enables cost tracking without changing the underlying architecture.
"""

import asyncio
from typing import Any

import litellm
from asynciolimiter import Limiter
from litellm import acompletion
from litellm import exceptions as litellm_exceptions

from solver.poetiq.types import Models, TokenUsage

# Silence unnecessary litellm logs
litellm.suppress_debug_info = True

RETRIES = 3
RETRY_DELAY_SEC = 5

# Rate limiters per model (requests per second)
# Kept from original Poetiq implementation
limiters: dict[Models, Limiter] = {
    # Direct API models
    "groq/openai/gpt-oss-120b": Limiter(1.0),
    "openai/gpt-5": Limiter(1.0),
    "openai/gpt-5.1": Limiter(1.0),
    "xai/grok-4-fast": Limiter(1.0),
    "xai/grok-4": Limiter(1.0),
    "anthropic/claude-sonnet-4-5": Limiter(1.0),
    "anthropic/claude-haiku-4-5": Limiter(1.0),
    "gemini/gemini-2.5-pro": Limiter(2.0),
    "gemini/gemini-3-pro-preview": Limiter(1.0),
    # OpenRouter models - more generous limits since paid API
    "openrouter/google/gemini-3-pro-preview": Limiter(2.0),
    "openrouter/google/gemini-2.5-flash-preview-09-2025": Limiter(3.0),
    "openrouter/anthropic/claude-sonnet-4": Limiter(2.0),
    "openrouter/openai/gpt-5.1": Limiter(2.0),
}

# Model-specific properties (reasoning_effort, thinking config, etc.)
# Kept from original Poetiq implementation
props: dict[Models, dict] = {
    # Direct API models
    "groq/openai/gpt-oss-120b": {},
    "openai/gpt-5": {"reasoning_effort": "high"},
    "openai/gpt-5.1": {"reasoning_effort": "high"},
    "xai/grok-4-fast": {},
    "xai/grok-4": {},
    "anthropic/claude-sonnet-4-5": {"thinking": {"type": "enabled", "budget_tokens": 32_000}},
    "anthropic/claude-haiku-4-5": {"thinking": {"type": "enabled", "budget_tokens": 32_000}},
    "gemini/gemini-2.5-pro": {"thinking": {"type": "enabled", "budget_tokens": 16_000}},
    "gemini/gemini-3-pro-preview": {},
    # OpenRouter models
    "openrouter/google/gemini-3-pro-preview": {},
    "openrouter/google/gemini-2.5-flash-preview-09-2025": {},
    "openrouter/anthropic/claude-sonnet-4": {"thinking": {"type": "enabled", "budget_tokens": 32_000}},
    "openrouter/openai/gpt-5.1": {"reasoning_effort": "high"},
}

# Default limiter for unknown models (conservative 1 req/sec)
default_limiter = Limiter(1.0)


async def llm(
    model: str,
    message: str,
    temperature,
    request_timeout: int | None,
    max_remaining_time: float | None,
    max_remaining_timeouts: int | None,
    problem_id: str | None = None,
    retries: int = RETRIES,
    **kwargs,  # Accept extra parameters like reasoning_effort
) -> tuple[str, float, float | None, int | None, TokenUsage]:
    """
    Call the LLM via litellm and return (response_text, duration, remaining_time, remaining_timeouts, token_usage).
    
    This implementation uses litellm for multi-provider routing (faithful to original Poetiq).
    ENHANCED: Now captures token usage from resp.usage (original Poetiq discarded this!)
    
    Args:
        model: Model identifier in litellm format (e.g., "gemini/gemini-3-pro-preview")
        message: The prompt to send
        temperature: Sampling temperature
        request_timeout: Maximum time for this request (seconds)
        max_remaining_time: Time budget remaining for this problem
        max_remaining_timeouts: Timeout budget remaining
        problem_id: Optional identifier for logging
        retries: Number of retry attempts
        **kwargs: Additional parameters (reasoning_effort, verbosity, etc.)
    
    Returns:
        Tuple of (response_text, duration_seconds, remaining_time, remaining_timeouts, token_usage)
    """
    attempt = 1
    while attempt <= retries:
        # Use specific limiter or default
        limiter = limiters.get(model, default_limiter)
        await limiter.wait()

        current_request_timeout = request_timeout or 15 * 60  # Default 15 min
        if max_remaining_time is not None:
            current_request_timeout = min(current_request_timeout, max_remaining_time)

        # Merge static props with dynamic kwargs
        model_props = props.get(model, {}).copy()
        model_props.update(kwargs)

        start_time = asyncio.get_event_loop().time()
        try:
            resp: Any = await acompletion(
                model=model,
                messages=[{"role": "user", "content": message}],
                temperature=temperature,
                timeout=current_request_timeout,
                num_retries=0,
                **model_props,
            )
            end_time = asyncio.get_event_loop().time()
            duration = end_time - start_time
            
            if max_remaining_time is not None:
                max_remaining_time -= duration
            
            # Extract response text (same as original)
            response_text = resp["choices"][0]["message"]["content"].strip()
            
            # ENHANCED: Extract token usage from litellm response
            # Original Poetiq discarded this data - we now capture it!
            token_usage: TokenUsage = {}
            if hasattr(resp, 'usage') and resp.usage:
                token_usage = {
                    "input_tokens": getattr(resp.usage, 'prompt_tokens', 0) or 0,
                    "output_tokens": getattr(resp.usage, 'completion_tokens', 0) or 0,
                    "total_tokens": getattr(resp.usage, 'total_tokens', 0) or 0,
                }
            
            return (
                response_text,
                duration,
                max_remaining_time,
                max_remaining_timeouts,
                token_usage,  # NEW: token usage data
            )

        except (
            litellm_exceptions.RateLimitError,
            litellm_exceptions.InternalServerError,
            litellm_exceptions.ServiceUnavailableError,
            litellm_exceptions.APIConnectionError,
            litellm_exceptions.APIError,
        ) as e:
            # None of these exceptions should prevent the problem from being solved,
            # so don't let them count against the allotted retries.
            print(f"{problem_id or ''} Ignoring {type(e).__name__} and retrying attempt {attempt}: {e}")
            await asyncio.sleep(RETRY_DELAY_SEC)
            continue

        except Exception as e:
            end_time = asyncio.get_event_loop().time()
            duration = end_time - start_time
            if max_remaining_time is not None:
                max_remaining_time -= duration

            if "Timeout" in str(e):
                if max_remaining_timeouts is not None:
                    max_remaining_timeouts -= 1
                    print(
                        f"{problem_id or ''} Timed out. Remaining timeouts: {max_remaining_timeouts}"
                    )
                if max_remaining_timeouts is not None and max_remaining_timeouts <= 0:
                    raise RuntimeError("Exceeded timeouts allotted to the request")

                if attempt == retries:
                    return (
                        "Timeout",
                        duration,
                        max_remaining_time,
                        max_remaining_timeouts,
                        {},  # Empty token usage on timeout
                    )
                    
            if max_remaining_time is not None and max_remaining_time <= 0:
                raise RuntimeError("Exceeded time allotted to the request")

            if attempt == retries:
                print(f"{problem_id or ''} Max retry limit reached. Last exception during call:")
                print(str(e))
                raise e

            print(str(e))
            print(f"Exception during request for problem: {problem_id or ''}. Retry number {attempt}.")
            await asyncio.sleep(RETRY_DELAY_SEC)

            # Increment attempt at the end of the loop.
            attempt += 1

    raise RuntimeError("Retries exceeded")


# Backward compatibility: wrapper that drops token_usage for code expecting old signature
async def llm_compat(
    model: str,
    message: str,
    temperature,
    request_timeout: int | None,
    max_remaining_time: float | None,
    max_remaining_timeouts: int | None,
    problem_id: str | None = None,
    retries: int = RETRIES,
    **kwargs,
) -> tuple[str, float, float | None, int | None]:
    """
    Backward-compatible wrapper that matches the original Poetiq signature.
    Use llm() directly to get token usage.
    """
    result = await llm(
        model, message, temperature, request_timeout,
        max_remaining_time, max_remaining_timeouts,
        problem_id, retries, **kwargs
    )
    # Return first 4 elements, dropping token_usage
    return result[:4]
