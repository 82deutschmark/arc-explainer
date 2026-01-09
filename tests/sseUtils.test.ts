/**
 * Author: GPT-5 Codex
 * Date: 2026-01-08T20:25:33-05:00
 * PURPOSE: Validate SSE event parsing for JSON payloads, done markers, and fallback text.
 * SRP/DRY check: Pass - Focused on sseUtils parse behavior only.
 */

import { describe, it, expect } from 'vitest';
import { parseSseEvent } from '../server/services/streaming/sseUtils.ts';

describe('parseSseEvent', () => {
  it('parses JSON payloads', () => {
    const raw = 'event: response.output_text.delta\ndata: {"delta":"hi"}';
    const parsed = parseSseEvent(raw);
    expect(parsed?.event).toBe('response.output_text.delta');
    expect(parsed?.data).toEqual({ delta: 'hi' });
  });

  it('returns done event for [DONE]', () => {
    const parsed = parseSseEvent('data: [DONE]');
    expect(parsed?.event).toBe('done');
  });

  it('returns plain string data when JSON fails', () => {
    const raw = 'event: response.reasoning_text.delta\ndata: not-json';
    const parsed = parseSseEvent(raw);
    expect(parsed?.event).toBe('response.reasoning_text.delta');
    expect(parsed?.data).toBe('not-json');
  });
});
