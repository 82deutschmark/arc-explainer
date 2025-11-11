/*
Author: gpt-5-codex
Date: 2025-11-06
PURPOSE: Shared type definitions for the ARC-AGI-3 playground simulator and agent runner services.
SRP/DRY check: Pass — centralizes enums and interfaces used by the new ARC3 backend modules.
*/

import type { FrameData } from './Arc3ApiClient.ts';

export type Arc3GameState = 'NOT_PLAYED' | 'IN_PROGRESS' | 'WIN' | 'GAME_OVER' | 'NOT_FINISHED';

export interface Arc3RunTimelineEntry {
  index: number;
  type: 'assistant_message' | 'tool_call' | 'tool_result' | 'reasoning';
  label: string;
  content: string;
}

export interface Arc3AgentRunResult {
  runId: string;
  gameGuid: string;  // Game session identifier for continuation
  finalOutput?: string;
  timeline: Arc3RunTimelineEntry[];
  frames: any[];
  summary: Arc3RunSummary;
  usage: {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  providerResponseId?: string | null;
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

export interface Arc3AgentRunConfig {
  agentName?: string;
  systemPrompt?: string;
  instructions: string;
  model?: string;
  maxTurns?: number;
  game_id?: string;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  existingGameGuid?: string;  // For continuing existing game sessions
  previousResponseId?: string; // Responses API chaining support
  storeResponse?: boolean; // Whether to persist the response server-side
  seedFrame?: FrameData; // Optional cached frame to seed continuations without extra API calls
}
