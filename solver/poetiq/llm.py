"""
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-27
 * PURPOSE: LLM interface for Poetiq solver using direct Google Generative AI SDK.
 *          Replaces litellm dependency with direct API calls.
 *          Now includes token usage tracking for cost analysis.
 * SRP and DRY check: Pass - LLM interface only.
 * 
 * KEY CHANGE: This file replaces the litellm-based implementation with direct
 * google-generativeai SDK calls, following the Saturn solver pattern.
"""

import asyncio
import os
from typing import Any, Optional

from asynciolimiter import Limiter

# Import Google Generative AI SDK directly (like Saturn uses OpenAI SDK)
try:
    import google.generativeai as genai
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False
    genai = None

from solver.poetiq.types import TokenUsage

# Configure the SDK with API key from environment
if GENAI_AVAILABLE and os.environ.get("GEMINI_API_KEY"):
    genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

RETRIES = 3
RETRY_DELAY_SEC = 5

# Rate limiters per model (requests per second)
# Using asynciolimiter for rate limiting (kept from original)
limiters: dict[str, Limiter] = {
    "gemini-3-pro-preview": Limiter(1.0),
    "gemini-2.5-pro": Limiter(2.0),
    "gemini-2.5-flash": Limiter(3.0),
    "gemini-2.0-flash": Limiter(5.0),
}

# Default limiter for unknown models (conservative 1 req/sec)
default_limiter = Limiter(1.0)


def _normalize_model_name(model: str) -> str:
    """
    Normalize model identifier to what google-generativeai expects.
    Strips provider prefixes like 'gemini/', 'openrouter/google/', etc.
    """
    # Remove common prefixes
    prefixes = [
        "gemini/",
        "openrouter/google/",
        "google/",
    ]
    normalized = model
    for prefix in prefixes:
        if normalized.startswith(prefix):
            normalized = normalized[len(prefix):]
            break
    return normalized


async def llm(
    model: str,
    message: str,
    temperature: float,
    request_timeout: int | None,
    max_remaining_time: float | None,
    max_remaining_timeouts: int | None,
    problem_id: str | None = None,
    retries: int = RETRIES,
    **kwargs,  # Accept extra parameters like reasoning_effort
) -> tuple[str, float, float | None, int | None, TokenUsage]:
    """
    Call the LLM and return (response_text, duration, remaining_time, remaining_timeouts, token_usage).
    
    This implementation uses direct Google Generative AI SDK instead of litellm.
    Token usage is now tracked and returned for cost analysis.
    
    Args:
        model: Model identifier (will be normalized)
        message: The prompt to send
        temperature: Sampling temperature
        request_timeout: Maximum time for this request (seconds)
        max_remaining_time: Time budget remaining for this problem
        max_remaining_timeouts: Timeout budget remaining
        problem_id: Optional identifier for logging
        retries: Number of retry attempts
        **kwargs: Additional parameters (reasoning_effort, etc.)
    
    Returns:
        Tuple of (response_text, duration_seconds, remaining_time, remaining_timeouts, token_usage)
    """
    if not GENAI_AVAILABLE:
        raise RuntimeError(
            "google-generativeai package not installed. "
            "Install with: pip install google-generativeai"
        )
    
    if not os.environ.get("GEMINI_API_KEY"):
        raise RuntimeError(
            "GEMINI_API_KEY environment variable not set. "
            "Set it in your .env file or environment."
        )
    
    # Normalize model name
    model_name = _normalize_model_name(model)
    
    attempt = 1
    while attempt <= retries:
        # Use specific limiter or default
        limiter = limiters.get(model_name, default_limiter)
        await limiter.wait()
        
        current_request_timeout = request_timeout or 15 * 60  # Default 15 min
        if max_remaining_time is not None:
            current_request_timeout = min(current_request_timeout, max_remaining_time)
        
        start_time = asyncio.get_event_loop().time()
        
        try:
            # Create model instance
            model_obj = genai.GenerativeModel(model_name)
            
            # Build generation config
            generation_config = {
                "temperature": temperature,
            }
            
            # Handle thinking/reasoning for advanced models
            if "2.5" in model_name or "3" in model_name:
                # Gemini 2.5+ supports thinking config
                if kwargs.get("thinking"):
                    # Pass through thinking config if provided
                    generation_config["thinking_config"] = kwargs["thinking"]
            
            # Make the async API call
            response = await asyncio.wait_for(
                model_obj.generate_content_async(
                    message,
                    generation_config=generation_config,
                ),
                timeout=current_request_timeout,
            )
            
            end_time = asyncio.get_event_loop().time()
            duration = end_time - start_time
            
            if max_remaining_time is not None:
                max_remaining_time -= duration
            
            # Extract response text
            response_text = ""
            if response.text:
                response_text = response.text.strip()
            elif response.candidates:
                # Fallback: extract from candidates
                for candidate in response.candidates:
                    if candidate.content and candidate.content.parts:
                        for part in candidate.content.parts:
                            if hasattr(part, 'text') and part.text:
                                response_text += part.text
                response_text = response_text.strip()
            
            # Extract token usage (NEW - this was missing in litellm version!)
            token_usage: TokenUsage = {}
            if hasattr(response, 'usage_metadata') and response.usage_metadata:
                metadata = response.usage_metadata
                token_usage = {
                    "input_tokens": getattr(metadata, 'prompt_token_count', 0) or 0,
                    "output_tokens": getattr(metadata, 'candidates_token_count', 0) or 0,
                    "total_tokens": getattr(metadata, 'total_token_count', 0) or 0,
                }
            
            return (
                response_text,
                duration,
                max_remaining_time,
                max_remaining_timeouts,
                token_usage,
            )
        
        except asyncio.TimeoutError:
            end_time = asyncio.get_event_loop().time()
            duration = end_time - start_time
            
            if max_remaining_time is not None:
                max_remaining_time -= duration
            
            if max_remaining_timeouts is not None:
                max_remaining_timeouts -= 1
                print(f"{problem_id or ''} Timed out. Remaining timeouts: {max_remaining_timeouts}")
            
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
            
        except Exception as e:
            error_str = str(e)
            end_time = asyncio.get_event_loop().time()
            duration = end_time - start_time
            
            if max_remaining_time is not None:
                max_remaining_time -= duration
            
            # Check for rate limit errors (retry without counting against retries)
            if "429" in error_str or "rate" in error_str.lower() or "quota" in error_str.lower():
                print(f"{problem_id or ''} Rate limited, waiting before retry: {e}")
                await asyncio.sleep(RETRY_DELAY_SEC * 2)  # Longer wait for rate limits
                continue
            
            # Check for server errors (retry without counting against retries)
            if "500" in error_str or "503" in error_str or "unavailable" in error_str.lower():
                print(f"{problem_id or ''} Server error, retrying: {e}")
                await asyncio.sleep(RETRY_DELAY_SEC)
                continue
            
            if max_remaining_time is not None and max_remaining_time <= 0:
                raise RuntimeError("Exceeded time allotted to the request")
            
            if attempt == retries:
                print(f"{problem_id or ''} Max retry limit reached. Last exception: {e}")
                raise e
            
            print(f"{problem_id or ''} Error on attempt {attempt}: {e}")
            await asyncio.sleep(RETRY_DELAY_SEC)
        
        attempt += 1
    
    raise RuntimeError("Retries exceeded")


# Backward compatibility: wrapper that drops token_usage for code expecting old signature
async def llm_compat(
    model: str,
    message: str,
    temperature: float,
    request_timeout: int | None,
    max_remaining_time: float | None,
    max_remaining_timeouts: int | None,
    problem_id: str | None = None,
    retries: int = RETRIES,
    **kwargs,
) -> tuple[str, float, float | None, int | None]:
    """
    Backward-compatible wrapper that matches the original litellm signature.
    Use llm() directly to get token usage.
    """
    result = await llm(
        model, message, temperature, request_timeout,
        max_remaining_time, max_remaining_timeouts,
        problem_id, retries, **kwargs
    )
    # Return first 4 elements, dropping token_usage
    return result[:4]
