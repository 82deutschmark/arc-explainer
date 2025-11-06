/*
Author: gpt-5-codex
Date: 2025-11-06
PURPOSE: React Query mutation for triggering ARC3 playground agent runs from the UI.
SRP/DRY check: Pass — encapsulates fetch logic and error handling for reuse across components.
*/

import { useMutation } from '@tanstack/react-query';
import type { Arc3AgentRunPayload, Arc3AgentRunData, Arc3AgentRunResponse } from '@/types/arc3';

async function runArc3Agent(payload: Arc3AgentRunPayload): Promise<Arc3AgentRunData> {
  const response = await fetch('/api/arc3/agent-playground/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`ARC3 agent run failed with status ${response.status}`);
  }

  const result: Arc3AgentRunResponse = await response.json();
  if (!result.success) {
    throw new Error('ARC3 agent run failed');
  }

  return result.data;
}

export function useArc3AgentRun() {
  return useMutation({
    mutationKey: ['arc3-agent-run'],
    mutationFn: runArc3Agent,
  });
}
