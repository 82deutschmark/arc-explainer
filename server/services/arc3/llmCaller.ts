/*
Author: Claude Sonnet 4.6 (Bubba)
Date: 25-March-2026
PURPOSE: Unified LLM caller for ARC3 agent loop. Routes claude-* to Anthropic SDK, gpt-* / o1-* / o3-* / o4-* to OpenAI SDK, openrouter/* to OpenRouter REST API. Single entry point for all LLM calls in the ARC3 direct-loop runner.
SRP/DRY check: Pass — single responsibility: accept system+user prompt, return text + token counts. No game logic here.
*/

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export interface LLMCallOptions {
  model: string;
  system: string;
  user: string;
  apiKey?: string;  // Optional BYOK
  maxTokens?: number;
}

export interface LLMCallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Call an LLM with a system + user prompt.
 * Routes by model prefix:
 *   - claude-*        → Anthropic SDK (supports OAuth header when key starts with sk-ant-oat01-)
 *   - gpt-*, o1-*, o3-*, o4-* → OpenAI SDK
 *   - openrouter/*    → OpenRouter via fetch
 *
 * Throws if model prefix is unrecognized.
 */
export async function callLLM(opts: LLMCallOptions): Promise<LLMCallResult> {
  const { model, system, user, apiKey, maxTokens = 4096 } = opts;

  // --- Anthropic ---
  if (model.startsWith('claude-')) {
    const isOAuth = apiKey?.startsWith('sk-ant-oat01-');
    const client = new Anthropic({
      apiKey: apiKey ?? process.env.ANTHROPIC_OAUTHTOKEN ?? process.env.ANTHROPIC_API_KEY,
      ...(isOAuth ? {
        defaultHeaders: {
          'anthropic-beta': 'oauth-2025-04-20',
        },
      } : {}),
    });

    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: system || undefined,
      messages: [{ role: 'user', content: user }],
    });

    const text = response.content
      .filter(block => block.type === 'text')
      .map(block => (block as { type: 'text'; text: string }).text)
      .join('');

    return {
      text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }

  // --- OpenAI ---
  if (
    model.startsWith('gpt-') ||
    model.startsWith('o1-') ||
    model.startsWith('o3-') ||
    model.startsWith('o4-')
  ) {
    const client = new OpenAI({
      apiKey: apiKey ?? process.env.OPENAI_API_KEY,
    });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (system) {
      messages.push({ role: 'system', content: system });
    }
    messages.push({ role: 'user', content: user });

    const response = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages,
    });

    const text = response.choices[0]?.message?.content ?? '';

    return {
      text,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    };
  }

  // --- OpenRouter ---
  if (model.startsWith('openrouter/')) {
    const openrouterModel = model.replace(/^openrouter\//, '');
    const resolvedKey = apiKey ?? process.env.OPENROUTER_API_KEY;

    if (!resolvedKey) {
      throw new Error('[llmCaller] No API key available for OpenRouter. Set OPENROUTER_API_KEY env var.');
    }

    const body: Record<string, unknown> = {
      model: openrouterModel,
      max_tokens: maxTokens,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: user },
      ],
    };

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resolvedKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '(no body)');
      throw new Error(`[llmCaller] OpenRouter error ${res.status}: ${errText}`);
    }

    const json = await res.json() as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    const text = json.choices[0]?.message?.content ?? '';

    return {
      text,
      inputTokens: json.usage?.prompt_tokens ?? 0,
      outputTokens: json.usage?.completion_tokens ?? 0,
    };
  }

  throw new Error(
    `[llmCaller] Unknown model prefix: "${model}". ` +
    `Supported prefixes: claude-*, gpt-*, o1-*, o3-*, o4-*, openrouter/*`
  );
}
