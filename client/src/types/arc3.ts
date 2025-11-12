/*
Author: gpt-5-codex
Date: 2025-11-06
PURPOSE: Shared frontend TypeScript types mirroring the ARC3 playground API payloads.
SRP/DRY check: Pass — isolates API contracts from UI components for reuse.
*/

// States returned by ARC3 API (see docs/reference/arc3/arc3apicommands.md)
export type Arc3GameState = 'NOT_STARTED' | 'NOT_FINISHED' | 'WIN' | 'GAME_OVER';

export interface Arc3FrameSnapshot {
  step: number;
  state: Arc3GameState;
  score: number;
  board: number[][];
  actionLabel: string;
  narrative: string;
  remainingSteps: number;
}

export interface Arc3RunSummary {
  state: Arc3GameState;
  score: number;
  stepsTaken: number;
  simpleActionsUsed: string[];
  coordinateGuesses: number;
  scenarioId: string;
  scenarioName: string;
}

export interface Arc3RunTimelineEntry {
  index: number;
  type: 'assistant_message' | 'tool_call' | 'tool_result' | 'reasoning';
  label: string;
  content: string;
}

export interface Arc3AgentRunData {
  runId: string;
  finalOutput?: string;
  timeline: Arc3RunTimelineEntry[];
  frames: Arc3FrameSnapshot[];
  summary: Arc3RunSummary;
  usage: {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export interface Arc3AgentRunResponse {
  success: boolean;
  data: Arc3AgentRunData;
}

export interface Arc3AgentRunPayload {
  agentName?: string;
  instructions: string;
  model?: string;
  maxTurns?: number;
  scenarioId?: string;
}
