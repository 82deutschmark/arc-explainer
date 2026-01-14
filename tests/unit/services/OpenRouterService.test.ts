/**
 * Author: Cascade (OpenAI o4-preview)
 * Date: 2026-01-13T20:44:00Z
 * PURPOSE: Validate OpenRouter reasoning payload defaults so captureReasoning requests use medium effort unless overridden.
 * SRP/DRY check: Pass – focuses on helper behavior only.
 */

import { describe, it, expect } from 'vitest';

import { resolveOpenRouterReasoningOptions } from '../../../server/services/openrouter.ts';
import type { ServiceOptions } from '../../../server/services/base/BaseAIService.ts';

describe('resolveOpenRouterReasoningOptions', () => {
  it('returns undefined when captureReasoning is disabled', () => {
    const opts: ServiceOptions = { captureReasoning: false };
    expect(resolveOpenRouterReasoningOptions(opts)).toBeUndefined();
  });

  it('defaults effort to medium when not provided', () => {
    const result = resolveOpenRouterReasoningOptions({ captureReasoning: true });
    expect(result).toEqual({
      enabled: true,
      effort: 'medium',
      exclude: false,
    });
  });

  it('honors an explicit reasoningEffort override', () => {
    const result = resolveOpenRouterReasoningOptions({
      captureReasoning: true,
      reasoningEffort: 'low',
    });
    expect(result).toMatchObject({
      enabled: true,
      effort: 'low',
    });
  });
});
