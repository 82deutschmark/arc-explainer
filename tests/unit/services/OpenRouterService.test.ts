/**
 * Author: Cascade (ChatGPT 5.1)
 * Date: 2026-01-13T17:12:00Z
 * PURPOSE: Validate OpenRouter reasoning payload defaults so captureReasoning requests use high effort unless overridden.
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

  it('defaults effort to high when not provided', () => {
    const result = resolveOpenRouterReasoningOptions({ captureReasoning: true });
    expect(result).toEqual({
      enabled: true,
      effort: 'high',
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
