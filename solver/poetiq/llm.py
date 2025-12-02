"""
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-27
 * Updated: 2025-11-27 - REMOVED LiteLLM, now uses direct SDK calls for all providers
 * PURPOSE: LLM interface for Poetiq solver using DIRECT SDK calls.
 *          NO LiteLLM dependency - we use OpenAI, Anthropic, and Google SDKs directly.
 *          This matches the pattern used in our main TypeScript services.
 * 
 * SRP and DRY check: Pass - LLM interface only, delegates to provider-specific functions.
 * 
 * MIGRATION NOTES:
 * - OpenAI models: Use OpenAI SDK Responses API (POST /v1/responses)
 * - Anthropic models: Use Anthropic SDK Messages API  
 * - Google Gemini models: Use Google Generative AI SDK
 * - OpenRouter models: Use OpenAI SDK pointed at OpenRouter base URL
 * - xAI models: Use OpenAI SDK pointed at xAI base URL
"""

import asyncio
import os
import time
from typing import Any, Optional, Tuple

# Direct SDK imports - NO LiteLLM
import openai
import anthropic
import google.generativeai as genai

from asynciolimiter import Limiter
from solver.poetiq.types import Models, TokenUsage

RETRIES = 3
RETRY_DELAY_SEC = 5

# Rate limiters per model (requests per second)
limiters: dict[str, Limiter] = {
    # Direct OpenAI API models
    "openai/gpt-5": Limiter(1.0),
    "openai/gpt-5.1": Limiter(1.0),
    "gpt-5.1-codex-mini": Limiter(1.0),
    "gpt-5-mini": Limiter(1.0),
    "gpt-5-nano": Limiter(1.0),
    "o3-mini": Limiter(1.0),
    "o4-mini": Limiter(1.0),
    "o3-2025-04-16": Limiter(1.0),
    # Direct Anthropic models
    "anthropic/claude-sonnet-4-5": Limiter(1.0),
    "anthropic/claude-haiku-4-5": Limiter(1.0),
    "claude-sonnet-4": Limiter(1.0),
    "claude-sonnet-4-5": Limiter(1.0),
    # Direct Gemini models
    "gemini/gemini-2.5-pro": Limiter(2.0),
    "gemini/gemini-3-pro-preview": Limiter(1.0),
    "gemini-3-pro-preview": Limiter(1.0),
    "gemini-2.5-pro": Limiter(2.0),
    # xAI models (OpenAI-compatible)
    "xai/grok-4-fast": Limiter(1.0),
    "xai/grok-4": Limiter(1.0),
    # DeepSeek models (OpenAI-compatible)
    "deepseek-chat": Limiter(1.0),
    "deepseek-reasoner": Limiter(0.5),  # Slower rate for reasoning models
    "deepseek-reasoner-speciale": Limiter(0.5),
    # OpenRouter models
    "openrouter/google/gemini-3-pro-preview": Limiter(2.0),
    "openrouter/google/gemini-2.5-flash-preview-09-2025": Limiter(3.0),
    "openrouter/anthropic/claude-sonnet-4": Limiter(2.0),
    "openrouter/openai/gpt-5.1": Limiter(2.0),
}

default_limiter = Limiter(1.0)


# ==========================================
# PROVIDER DETECTION
# ==========================================
def get_provider(model: str) -> str:
    """
    Determine which provider/SDK to use for a given model ID.
    Returns: 'openai', 'anthropic', 'gemini', 'openrouter', 'xai', 'deepseek'
    """
    model_lower = model.lower()

    # Check for OpenRouter first (it can proxy any model)
    if 'openrouter' in model_lower:
        return 'openrouter'

    # Direct OpenAI models (use Responses API)
    if any(x in model_lower for x in ['gpt-5', 'o3-', 'o4-', 'gpt-4.1']):
        return 'openai'

    # Anthropic models
    if any(x in model_lower for x in ['claude', 'anthropic']):
        return 'anthropic'

    # Google Gemini models
    if 'gemini' in model_lower:
        return 'gemini'

    # xAI Grok models (OpenAI-compatible API)
    if any(x in model_lower for x in ['grok', 'xai']):
        return 'xai'

    # DeepSeek models (OpenAI-compatible API)
    if 'deepseek' in model_lower:
        return 'deepseek'

    # Default to OpenRouter for unknown models
    return 'openrouter'


def extract_model_name(model: str) -> str:
    """
    Extract the actual model name from a prefixed model ID.
    E.g., "gemini/gemini-3-pro-preview" -> "gemini-3-pro-preview"
          "openrouter/google/gemini-3-pro" -> "google/gemini-3-pro"
    """
    parts = model.split('/')
    if len(parts) >= 2:
        # For openrouter, keep the last two parts (org/model)
        if parts[0].lower() == 'openrouter' and len(parts) >= 3:
            return '/'.join(parts[1:])
        # For other prefixes, just take the last part
        return parts[-1]
    return model


# ==========================================
# OPENAI RESPONSES API (GPT-5.x, o3, o4)
# ==========================================
async def llm_openai(
    model: str,
    message: str,
    system_prompt: Optional[str] = None,
    temperature: float = 1.0,
    timeout: int = 900,
    problem_id: Optional[str] = None,
    messages: Optional[list[dict[str, str]]] = None,
    previous_response_id: Optional[str] = None,
    **kwargs,
) -> Tuple[str, TokenUsage, str, Optional[str]]:
    """
    Call OpenAI via Responses API (POST /v1/responses).
    Uses proper reasoning parameters for GPT-5.x models.
    
    Returns: (response_text, token_usage, reasoning_summary)
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable not set")
    
    client = openai.AsyncOpenAI(api_key=api_key)
    model_name = extract_model_name(model)
    
    # Build reasoning params for GPT-5.x and o3/o4 models
    reasoning_effort = kwargs.get('reasoning_effort', 'high')
    reasoning_summary = kwargs.get('reasoning_summary', 'detailed')

    # Verbosity defaults:
    # - gpt-5.1-codex and gpt-5.1-codex-mini only support 'medium' for text.verbosity (API will 400 on 'high')
    # - other GPT-5.x/o3 models retain the project-standard 'high' default
    verbosity_override = kwargs.get('verbosity')
    if model_name in ("gpt-5.1-codex", "gpt-5.1-codex-mini"):
        verbosity = 'medium'
    else:
        verbosity = verbosity_override or 'high'
    
    print(f"[OpenAI Responses API] Calling {model_name} with reasoning_effort={reasoning_effort}, verbosity={verbosity}")
    
    try:
        response = await client.responses.create(
            model=model_name,
            input=messages if messages else [{"role": "user", "content": message}],
            instructions=system_prompt or "You are a helpful AI assistant.",
            reasoning={
                "effort": reasoning_effort,
                "summary": reasoning_summary,
            },
            text={
                "verbosity": verbosity,
            },
            max_output_tokens=128000,
            store=True,
            previous_response_id=previous_response_id,
            include=["reasoning.encrypted_content"],
        )
        
        # Extract text from response.output[]
        output_text = ""
        reasoning_summary_text = ""
        
        for item in response.output:
            if item.type == "message":
                for content in item.content:
                    if hasattr(content, 'type') and content.type == "output_text":
                        output_text += content.text
            elif item.type == "reasoning":
                if hasattr(item, 'summary') and item.summary:
                    reasoning_summary_text = item.summary
        
        # Build token usage dict
        token_usage: TokenUsage = {
            "input_tokens": response.usage.input_tokens if response.usage else 0,
            "output_tokens": response.usage.output_tokens if response.usage else 0,
            "total_tokens": (response.usage.input_tokens + response.usage.output_tokens) if response.usage else 0,
        }
        
        # Extract reasoning tokens if available
        if response.usage and hasattr(response.usage, 'output_tokens_details'):
            details = response.usage.output_tokens_details
            if hasattr(details, 'reasoning_tokens'):
                token_usage["reasoning_tokens"] = details.reasoning_tokens
        
        return output_text, token_usage, reasoning_summary_text, response.id
        
    except openai.APIError as e:
        print(f"[OpenAI Responses API] Error: {e}")
        raise


# ==========================================
# ANTHROPIC MESSAGES API (Claude models)
# ==========================================
async def llm_anthropic(
    model: str,
    message: str,
    system_prompt: Optional[str] = None,
    temperature: float = 1.0,
    timeout: int = 900,
    problem_id: Optional[str] = None,
    **kwargs,
) -> Tuple[str, TokenUsage, str, Optional[str]]:
    """
    Call Anthropic via Messages API.
    Supports extended thinking for Claude Sonnet 4.x models.
    
    Returns: (response_text, token_usage, reasoning_summary)
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY environment variable not set")
    
    client = anthropic.AsyncAnthropic(api_key=api_key)
    model_name = extract_model_name(model)
    
    # Map model names to Anthropic's expected format
    model_mapping = {
        "claude-sonnet-4-5": "claude-sonnet-4-5-20250514",
        "claude-sonnet-4": "claude-sonnet-4-20250514",
        "claude-haiku-4-5": "claude-haiku-4-5-20250514",
        "claude-haiku-4": "claude-haiku-4-20250514",
    }
    api_model = model_mapping.get(model_name, model_name)
    
    print(f"[Anthropic Messages API] Calling {api_model}")
    
    # Check if extended thinking is supported/requested
    thinking_config = kwargs.get('thinking')
    
    try:
        request_params = {
            "model": api_model,
            "max_tokens": 64000,
            "messages": [{"role": "user", "content": message}],
        }
        
        if system_prompt:
            request_params["system"] = system_prompt
        
        # Only add temperature if thinking is not enabled
        # (Anthropic doesn't allow temperature with extended thinking)
        if not thinking_config:
            request_params["temperature"] = temperature
        
        # Add extended thinking if configured
        if thinking_config and thinking_config.get("type") == "enabled":
            budget = thinking_config.get("budget_tokens", 32000)
            # For Claude 4.x, use the thinking parameter
            request_params["thinking"] = {
                "type": "enabled",
                "budget_tokens": budget
            }
        
        response = await client.messages.create(**request_params)
        
        # Extract response text
        output_text = ""
        reasoning_text = ""
        
        for block in response.content:
            if block.type == "text":
                output_text += block.text
            elif block.type == "thinking":
                reasoning_text += block.thinking
        
        # Build token usage
        token_usage: TokenUsage = {
            "input_tokens": response.usage.input_tokens if response.usage else 0,
            "output_tokens": response.usage.output_tokens if response.usage else 0,
            "total_tokens": (response.usage.input_tokens + response.usage.output_tokens) if response.usage else 0,
        }
        
        return output_text, token_usage, reasoning_text, None
        
    except anthropic.APIError as e:
        print(f"[Anthropic Messages API] Error: {e}")
        raise


# ==========================================
# GOOGLE GEMINI API
# ==========================================
async def llm_gemini(
    model: str,
    message: str,
    system_prompt: Optional[str] = None,
    temperature: float = 1.0,
    timeout: int = 900,
    problem_id: Optional[str] = None,
    **kwargs,
) -> Tuple[str, TokenUsage, str, Optional[str]]:
    """
    Call Google Gemini via Generative AI SDK.
    Supports thinking for Gemini 2.5+ models.
    
    Returns: (response_text, token_usage, reasoning_summary)
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable not set")
    
    genai.configure(api_key=api_key)
    model_name = extract_model_name(model)
    
    print(f"[Google Gemini API] Calling {model_name}")
    
    # Build generation config
    generation_config = {
        "temperature": temperature,
        "response_mime_type": "application/json",  # For structured output
    }
    # Thinking config intentionally omitted — current SDK rejects `thinking_config` on Gemini 3.
    
    try:
        genai_model = genai.GenerativeModel(
            model_name=model_name,
            generation_config=generation_config,
            system_instruction=system_prompt if system_prompt else None,
        )
        
        # Use asyncio to run the sync API
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: genai_model.generate_content(message)
        )
        
        # Extract response text and reasoning
        output_text = ""
        reasoning_text = ""
        
        if response.candidates:
            candidate = response.candidates[0]
            if candidate.content and candidate.content.parts:
                for part in candidate.content.parts:
                    if hasattr(part, 'thought') and part.thought:
                        if hasattr(part, 'text'):
                            reasoning_text += part.text
                    elif hasattr(part, 'text'):
                        output_text += part.text
        
        # Build token usage
        token_usage: TokenUsage = {}
        if hasattr(response, 'usage_metadata') and response.usage_metadata:
            usage = response.usage_metadata
            token_usage = {
                "input_tokens": getattr(usage, 'prompt_token_count', 0) or 0,
                "output_tokens": getattr(usage, 'candidates_token_count', 0) or 0,
                "total_tokens": getattr(usage, 'total_token_count', 0) or 0,
            }
        
        return output_text, token_usage, reasoning_text, None
        
    except Exception as e:
        print(f"[Google Gemini API] Error: {e}")
        raise


# ==========================================
# OPENROUTER API (OpenAI-compatible)
# ==========================================
async def llm_openrouter(
    model: str,
    message: str,
    system_prompt: Optional[str] = None,
    temperature: float = 1.0,
    timeout: int = 900,
    problem_id: Optional[str] = None,
    **kwargs,
) -> Tuple[str, TokenUsage, str, Optional[str]]:
    """
    Call OpenRouter using OpenAI SDK with custom base URL.
    OpenRouter provides access to many models via a unified API.
    
    Returns: (response_text, token_usage, reasoning_summary)
    """
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY environment variable not set")
    
    # OpenRouter uses OpenAI-compatible API
    client = openai.AsyncOpenAI(
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1"
    )
    
    model_name = extract_model_name(model)
    
    print(f"[OpenRouter API] Calling {model_name}")
    
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": message})
    
    try:
        response = await client.chat.completions.create(
            model=model_name,
            messages=messages,
            temperature=temperature,
            max_tokens=128000,
        )
        
        # Extract response text
        output_text = response.choices[0].message.content.strip() if response.choices else ""
        
        # Build token usage
        token_usage: TokenUsage = {}
        if response.usage:
            token_usage = {
                "input_tokens": response.usage.prompt_tokens or 0,
                "output_tokens": response.usage.completion_tokens or 0,
                "total_tokens": response.usage.total_tokens or 0,
            }
        
        return output_text, token_usage, "", None
        
    except openai.APIError as e:
        print(f"[OpenRouter API] Error: {e}")
        raise


# ==========================================
# XAI API (OpenAI-compatible)
# ==========================================
async def llm_xai(
    model: str,
    message: str,
    system_prompt: Optional[str] = None,
    temperature: float = 1.0,
    timeout: int = 900,
    problem_id: Optional[str] = None,
    **kwargs,
) -> Tuple[str, TokenUsage, str, Optional[str]]:
    """
    Call xAI (Grok) using OpenAI SDK with custom base URL.
    
    Returns: (response_text, token_usage, reasoning_summary)
    """
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        raise ValueError("XAI_API_KEY environment variable not set")
    
    client = openai.AsyncOpenAI(
        api_key=api_key,
        base_url="https://api.x.ai/v1"
    )
    
    model_name = extract_model_name(model)
    
    print(f"[xAI API] Calling {model_name}")
    
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": message})
    
    try:
        response = await client.chat.completions.create(
            model=model_name,
            messages=messages,
            temperature=temperature,
            max_tokens=128000,
        )
        
        output_text = response.choices[0].message.content.strip() if response.choices else ""
        
        token_usage: TokenUsage = {}
        if response.usage:
            token_usage = {
                "input_tokens": response.usage.prompt_tokens or 0,
                "output_tokens": response.usage.completion_tokens or 0,
                "total_tokens": response.usage.total_tokens or 0,
            }
        
        return output_text, token_usage, "", None
        
    except openai.APIError as e:
        print(f"[xAI API] Error: {e}")
        raise


# ==========================================
# DEEPSEEK API (DeepSeek Chat, DeepSeek Reasoner)
# ==========================================
async def llm_deepseek(
    model: str,
    message: str,
    system_prompt: Optional[str] = None,
    temperature: float = 1.0,
    timeout: int = 900,
    problem_id: Optional[str] = None,
    **kwargs,
) -> Tuple[str, TokenUsage, str, Optional[str]]:
    """
    Call DeepSeek using OpenAI SDK with custom base URL.
    Supports both deepseek-chat and deepseek-reasoner models.

    Returns: (response_text, token_usage, reasoning_summary, provider_response_id)
    """
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise ValueError("DEEPSEEK_API_KEY environment variable not set")

    model_name = extract_model_name(model)

    # DeepSeek v3.2-Speciale uses a special base URL with expiration
    if 'speciale' in model_name.lower():
        base_url = "https://api.deepseek.com/v3.2_speciale_expires_on_20251215"
    else:
        base_url = "https://api.deepseek.com"

    client = openai.AsyncOpenAI(
        api_key=api_key,
        base_url=base_url,
        timeout=timeout * 1000,  # Convert to milliseconds
    )

    print(f"[DeepSeek API] Calling {model_name} via {base_url}")

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": message})

    # DeepSeek reasoner models don't support temperature (it's accepted but ignored)
    request_params = {
        "model": model_name,
        "messages": messages,
    }

    # Only add temperature for non-reasoner models
    if 'reasoner' not in model_name.lower():
        request_params["temperature"] = temperature

    try:
        response = await client.chat.completions.create(**request_params)

        output_text = response.choices[0].message.content.strip() if response.choices else ""

        token_usage: TokenUsage = {}
        if response.usage:
            token_usage = {
                "input_tokens": response.usage.prompt_tokens or 0,
                "output_tokens": response.usage.completion_tokens or 0,
                "total_tokens": response.usage.total_tokens or 0,
            }
            # DeepSeek reasoner models include reasoning tokens
            if hasattr(response.usage, 'reasoning_tokens') and response.usage.reasoning_tokens:
                token_usage["reasoning_tokens"] = response.usage.reasoning_tokens

        # Extract reasoning content for deepseek-reasoner models
        reasoning_summary = ""
        if 'reasoner' in model_name.lower():
            reasoning_content = getattr(response.choices[0].message, 'reasoning_content', None)
            if reasoning_content:
                reasoning_summary = reasoning_content
                print(f"[DeepSeek API] Extracted reasoning: {len(reasoning_summary)} chars")

        return output_text, token_usage, reasoning_summary, None

    except openai.APIError as e:
        print(f"[DeepSeek API] Error: {e}")
        raise


# ==========================================
# MAIN ROUTER FUNCTION
# ==========================================
async def llm(
    model: str,
    message: str,
    temperature: float = 1.0,
    request_timeout: int | None = None,
    max_remaining_time: float | None = None,
    max_remaining_timeouts: int | None = None,
    problem_id: str | None = None,
    retries: int = RETRIES,
    system_prompt: str | None = None,
    conversation_messages: list[dict[str, str]] | None = None,
    previous_response_id: str | None = None,
    **kwargs,
) -> tuple[str, float, float | None, int | None, TokenUsage, Optional[str]]:
    """
    Main LLM router - dispatches to the appropriate provider SDK.
    
    This function maintains the same signature as the original Poetiq llm() 
    for backward compatibility, but now uses direct SDK calls instead of LiteLLM.
    
    Args:
        model: Model identifier (e.g., "gemini/gemini-3-pro-preview", "gpt-5.1-codex-mini")
        message: The prompt to send
        temperature: Sampling temperature
        request_timeout: Maximum time for this request (seconds)
        max_remaining_time: Time budget remaining for this problem
        max_remaining_timeouts: Timeout budget remaining
        problem_id: Optional identifier for logging
        retries: Number of retry attempts
        system_prompt: Optional system prompt
        **kwargs: Additional parameters (reasoning_effort, thinking, etc.)
    
    Returns:
        Tuple of (response_text, duration_seconds, remaining_time, remaining_timeouts, token_usage, provider_response_id)
    """
    timeout = request_timeout or 15 * 60  # Default 15 min
    if max_remaining_time is not None:
        timeout = min(timeout, int(max_remaining_time))
    
    attempt = 1
    while attempt <= retries:
        # Apply rate limiting
        limiter = limiters.get(model, default_limiter)
        await limiter.wait()
        
        start_time = time.time()
        
        try:
            provider = get_provider(model)
            
            # Route to appropriate SDK
            if provider == 'openai':
                response_text, token_usage, reasoning_summary, provider_response_id = await llm_openai(
                    model,
                    message,
                    system_prompt,
                    temperature,
                    timeout,
                    problem_id,
                    messages=conversation_messages,
                    previous_response_id=previous_response_id,
                    **kwargs,
                )
            elif provider == 'anthropic':
                response_text, token_usage, reasoning_summary, provider_response_id = await llm_anthropic(
                    model, message, system_prompt, temperature, timeout, problem_id, **kwargs
                )
            elif provider == 'gemini':
                response_text, token_usage, reasoning_summary, provider_response_id = await llm_gemini(
                    model, message, system_prompt, temperature, timeout, problem_id, **kwargs
                )
            elif provider == 'xai':
                response_text, token_usage, reasoning_summary, provider_response_id = await llm_xai(
                    model, message, system_prompt, temperature, timeout, problem_id, **kwargs
                )
            elif provider == 'deepseek':
                response_text, token_usage, reasoning_summary, provider_response_id = await llm_deepseek(
                    model, message, system_prompt, temperature, timeout, problem_id, **kwargs
                )
            else:  # openrouter or unknown
                response_text, token_usage, reasoning_summary, provider_response_id = await llm_openrouter(
                    model, message, system_prompt, temperature, timeout, problem_id, **kwargs
                )
            
            duration = time.time() - start_time
            
            if max_remaining_time is not None:
                max_remaining_time -= duration
            
            return (
                response_text,
                duration,
                max_remaining_time,
                max_remaining_timeouts,
                token_usage,
                provider_response_id,
            )
            
        except Exception as e:
            duration = time.time() - start_time
            
            if max_remaining_time is not None:
                max_remaining_time -= duration
            
            error_str = str(e)
            
            # Handle timeout
            if "Timeout" in error_str or "timeout" in error_str.lower():
                if max_remaining_timeouts is not None:
                    max_remaining_timeouts -= 1
                    print(f"{problem_id or ''} Timed out. Remaining timeouts: {max_remaining_timeouts}")
                
                if max_remaining_timeouts is not None and max_remaining_timeouts <= 0:
                    raise RuntimeError("Exceeded timeouts allotted to the request")
                
                if attempt == retries:
                    return ("Timeout", duration, max_remaining_time, max_remaining_timeouts, {}, None)
            
            # Check time budget
            if max_remaining_time is not None and max_remaining_time <= 0:
                raise RuntimeError("Exceeded time allotted to the request")
            
            # Final attempt failed
            if attempt == retries:
                print(f"{problem_id or ''} Max retry limit reached. Last exception: {e}")
                raise e
            
            # Retry on transient errors
            if any(x in error_str for x in ['rate', 'limit', 'overload', '429', '503', '500']):
                print(f"{problem_id or ''} Retrying after transient error (attempt {attempt}): {e}")
                await asyncio.sleep(RETRY_DELAY_SEC)
                attempt += 1
                continue
            
            # Retry on other errors
            print(f"{problem_id or ''} Retrying after error (attempt {attempt}): {e}")
            await asyncio.sleep(RETRY_DELAY_SEC)
            attempt += 1
    
    raise RuntimeError("Retries exceeded")


# Backward compatibility wrapper
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
    return result[:4]
