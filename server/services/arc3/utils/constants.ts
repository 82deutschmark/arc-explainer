/*
Author: Claude Code using Sonnet 4.5
Date: 2025-11-06
PURPOSE: Centralized constants for ARC3 service configuration and defaults.
Extracted from Arc3RealGameRunner.ts to eliminate magic numbers and improve maintainability.
SRP/DRY check: Pass — single source of truth for ARC3 configuration constants.
*/

/**
 * Default OpenAI model for ARC3 agent runs
 */
export const DEFAULT_MODEL = 'gpt-5-nano';

/**
 * Default maximum turns for agent execution
 */
export const DEFAULT_MAX_TURNS = 24;

/**
 * Default game ID if not specified
 */
export const DEFAULT_GAME_ID = 'ls20';  // LockSmith game

/**
 * ARC3 API base URL
 */
export const ARC3_API_BASE_URL = 'https://three.arcprize.org';

/**
 * ARC3 grid dimensions
 */
export const ARC3_GRID_SIZE = 64;

/**
 * ARC3 color value range (0-15)
 */
export const ARC3_COLOR_MIN = 0;
export const ARC3_COLOR_MAX = 15;

/**
 * ARC3 game state values
 */
export const ARC3_STATES = {
  NOT_PLAYED: 'NOT_PLAYED',
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  WIN: 'WIN',
  GAME_OVER: 'GAME_OVER',
} as const;

/**
 * ARC3 action names
 */
export const ARC3_ACTIONS = {
  RESET: 'RESET',
  ACTION1: 'ACTION1',
  ACTION2: 'ACTION2',
  ACTION3: 'ACTION3',
  ACTION4: 'ACTION4',
  ACTION5: 'ACTION5',
  ACTION6: 'ACTION6',
} as const;

/**
 * Color names for 0-15 values (from SDK's palette)
 */
export const COLOR_NAMES: Record<number, string> = {
  0: 'black',
  1: 'blue',
  2: 'red',
  3: 'green',
  4: 'yellow',
  5: 'gray',
  6: 'magenta',
  7: 'orange',
  8: 'light-blue',
  9: 'brown',
  10: 'teal',
  11: 'lime',
  12: 'pink',
  13: 'purple',
  14: 'olive',
  15: 'white',
};
