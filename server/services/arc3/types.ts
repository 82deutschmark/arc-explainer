/*
Author: gpt-5-codex
Date: 2025-11-06
PURPOSE: Shared type definitions for the ARC-AGI-3 playground simulator and agent runner services.
SRP/DRY check: Pass — centralizes enums and interfaces used by the new ARC3 backend modules.
*/

export const ARC3_SIMPLE_ACTIONS = [
  'ACTION1',
  'ACTION2',
  'ACTION3',
  'ACTION4',
  'ACTION5',
] as const;

export type Arc3SimpleActionId = (typeof ARC3_SIMPLE_ACTIONS)[number];

export type Arc3ActionKind = 'reset' | 'simple' | 'coordinate';

export type Arc3GameState =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'WIN'
  | 'GAME_OVER';

export interface Arc3CoordinateAction {
  kind: 'coordinate';
  x: number;
  y: number;
}

export interface Arc3SimpleAction {
  kind: 'simple';
  id: Arc3SimpleActionId;
}

export interface Arc3ResetAction {
  kind: 'reset';
}

export type Arc3Action = Arc3CoordinateAction | Arc3SimpleAction | Arc3ResetAction;

export interface Arc3ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  target: { x: number; y: number };
  baseGrid: number[][];
  textHint: string;
  legend: Record<number, string>;
}

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
  simpleActionsUsed: Arc3SimpleActionId[];
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

export interface Arc3AgentRunResult {
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

export interface Arc3AgentRunConfig {
  agentName?: string;
  instructions: string;
  model?: string;
  maxTurns?: number;
  scenarioId?: string;
}
