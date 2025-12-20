/**
 * Author: Cascade
 * Date: 2025-12-20
 * PURPOSE: Source-of-truth plumbing for exposing the Worm Arena (SnakeBench) LLM player prompt.
 *          Provides two complementary representations:
 *          - B1 (live): Read the upstream Python source file (external/SnakeBench/backend/players/llm_player.py)
 *            and extract the prompt builder block for display.
 *          - B2 (canonical): A TypeScript-maintained, human-readable prompt template with explicit placeholders.
 *
 *          This is used by:
 *          - Public API endpoint: GET /api/snakebench/llm-player/prompt-template
 *          - Frontend: /worm-arena/rules
 *
 * SRP/DRY check: Pass - focused on prompt template retrieval/verification helpers only.
 */

import path from 'path';
import fs from 'fs';

export type WormArenaPromptSectionKey =
  | 'intro'
  | 'turn_context'
  | 'last_move_memory'
  | 'rules'
  | 'objective'
  | 'decision_process'
  | 'output_contract';

export interface WormArenaPromptTemplateBundle {
  pythonSourcePath: string;
  pythonSource: string;
  pythonPromptBuilderBlock: string;
  canonicalTemplate: string;
  canonicalFixedLines: string[];
  appleTarget: number | null;
}

function resolveLlmPlayerPythonPath(): string {
  return path.join(
    process.cwd(),
    'external',
    'SnakeBench',
    'backend',
    'players',
    'llm_player.py',
  );
}

function resolveSnakeBenchConstantsPythonPath(): string {
  return path.join(
    process.cwd(),
    'external',
    'SnakeBench',
    'backend',
    'domain',
    'constants.py',
  );
}

async function readAppleTargetFromPythonConstants(): Promise<number | null> {
  const constantsPath = resolveSnakeBenchConstantsPythonPath();
  if (!fs.existsSync(constantsPath)) return null;

  const source = await fs.promises.readFile(constantsPath, 'utf8');
  const match = source.match(/\bAPPLE_TARGET\s*=\s*(\d+)\b/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Returns a TypeScript-maintained prompt template (with placeholders).
 *
 * IMPORTANT:
 * - This is not intended to be executed.
 * - It exists so the UI can show a readable "what the model sees" template.
 * - We verify the fixed lines against the Python source in a unit test.
 */
export function getCanonicalLlmPlayerPromptTemplate(): string {
  // Keep this aligned with external/SnakeBench/backend/players/llm_player.py
  // (LLMPlayer._construct_prompt).
  return [
    'You are controlling a snake in a multi-apple Snake game. The board size is {width}x{height}. Normal X,Y coordinates are used. Coordinates range from (0,0) at bottom left to ({width_minus_1},{height_minus_1}) at top right. All snake coordinate lists are ordered head-to-tail: the first tuple is the head, each subsequent tuple connects to the previous one, and the last tuple is the tail.',
    '',
    'Turn: {round_number} / {max_rounds?}',
    '',
    'Apples at: {apples_list}',
    '',
    'Scores so far:',
    '  - Your snake (ID {your_id}) apples: {your_score}',
    '  - Snake #{enemy_id} apples: {enemy_score}',
    '',
    'Your snake (ID: {your_id}):',
    '  - Head: {your_head}',
    '  - Body: {your_body_or_none}',
    '  - Apples collected: {your_score}',
    '',
    'Enemy snakes:',
    '{enemy_snakes_list_or_none}',
    '',
    'Board state:',
    '{ascii_board_dump}',
    '',
    '--Your last move information:--',
    '',
    '**START LAST MOVE PICK**',
    '{last_move}',
    '**END LAST MOVE PICK**',
    '',
    '**START LAST RATIONALE**',
    '{last_rationale}',
    '**END LAST RATIONALE**',
    '',
    '--End of your last move information.--',
    '',
    'Rules and win conditions:',
    '- All snakes move simultaneously each turn.',
    '- Each turn, you choose one move: UP, DOWN, LEFT, or RIGHT. Every snake\'s head moves one cell in its chosen direction at the same time.',
    '- If you move onto an apple, you grow by 1 segment and gain 1 point (1 apple).',
    '- If you move outside the board (beyond the listed coordinate ranges), you die.',
    "- If your head moves into any snake's body (including your own), you die.",
    '- Moving directly backwards into your own body (into the cell directly behind your head) counts as hitting yourself and you die.',
    "- If another snake's head moves into any part of your body, that snake dies and your body remains.",
    '- If two snake heads move into the same cell on the same turn, both snakes die (head-on collision).',
    '- If all snakes die on the same turn for any reason, the game ends immediately and the snake with more apples at that moment wins; if apples are tied, the game is a draw.',
    '- The game ends immediately when any snake reaches {APPLE_TARGET} apples. If multiple snakes reach {APPLE_TARGET} or more on the same turn, the snake with the higher apple count wins that round; if tied, it is a draw.',
    '- The game lasts at most {max_rounds} turns.',
    '- If at any point all opponents are dead and you are alive, you immediately win.',
    '- If multiple snakes are still alive at the final turn, the snake with the most apples wins. If apples are tied at the end of the game, the game is a draw.',
    '',
    'Objective and strategy:',
    '- You cannot win if you are dead, so never choose a move that obviously kills you.',
    '- Among the moves that keep you alive, prefer moves that both:',
    '  * increase your chance of safely eating apples, and',
    '  * keep future options open (avoid getting trapped in tight spaces or dead-ends).',
    '',
    'Decision process for each move:',
    '1) Consider all four directions: UP, DOWN, LEFT, RIGHT.',
    '2) Eliminate any move that would immediately kill you (off the board, into your own body including backwards, or into another snake\'s body).',
    '3) Among remaining safe moves, favor moves that keep multiple safe follow-up moves available and move you closer to reachable apples while avoiding likely head-on collisions (remember enemy heads will also move this turn).',
    '',
    'You may think out loud and explain your reasoning.',
    'You may also write a short long-term plan or strategy note to your future self for the next few turns. This plan will be shown back to you as your last rationale on the next turn. Any such plan must appear before your final move line.',
    'Coordinate reminder: decreasing your x coordinate is to the left, increasing your x coordinate is to the right. Decreasing your y coordinate is down, increasing your y coordinate is up.',
    'The final non-empty line of your response must be exactly one word: UP, DOWN, LEFT, or RIGHT. Do not add anything after that word, and do not mention future directions after it.',
    '',
  ].join('\n');
}

/**
 * Returns a list of lines that MUST appear verbatim in the Python prompt.
 * This is used by tests and also returned to the client for transparency.
 */
export function getCanonicalFixedLines(): string[] {
  return [
    'Rules and win conditions:',
    '- All snakes move simultaneously each turn.',
    '- Each turn, you choose one move: UP, DOWN, LEFT, or RIGHT. Every snake\'s head moves one cell in its chosen direction at the same time.',
    '- If you move onto an apple, you grow by 1 segment and gain 1 point (1 apple).',
    '- If you move outside the board (beyond the listed coordinate ranges), you die.',
    "- If your head moves into any snake's body (including your own), you die.",
    '- Moving directly backwards into your own body (into the cell directly behind your head) counts as hitting yourself and you die.',
    "- If another snake's head moves into any part of your body, that snake dies and your body remains.",
    '- If two snake heads move into the same cell on the same turn, both snakes die (head-on collision).',
    '- If all snakes die on the same turn for any reason, the game ends immediately and the snake with more apples at that moment wins; if apples are tied, the game is a draw.',
    '- If at any point all opponents are dead and you are alive, you immediately win.',
    '- If multiple snakes are still alive at the final turn, the snake with the most apples wins. If apples are tied at the end of the game, the game is a draw.',
    'Objective and strategy:',
    '- You cannot win if you are dead, so never choose a move that obviously kills you.',
    'Decision process for each move:',
    'You may think out loud and explain your reasoning.',
    'The final non-empty line of your response must be exactly one word: UP, DOWN, LEFT, or RIGHT. Do not add anything after that word, and do not mention future directions after it.',
  ];
}

function extractPythonPromptBuilderBlock(pythonSource: string): string {
  // We intentionally expose the prompt builder, not only the rules, so users can see
  // the full context and IO contract.
  const startMarker = 'prompt = (';
  const startIdx = pythonSource.indexOf(startMarker);
  if (startIdx < 0) {
    throw new Error('Could not locate prompt builder start marker in llm_player.py');
  }

  const returnMarker = 'return prompt';
  const returnIdx = pythonSource.indexOf(returnMarker, startIdx);
  if (returnIdx < 0) {
    throw new Error('Could not locate prompt builder return marker in llm_player.py');
  }

  // Include the `prompt = (` block through the line before `return prompt`.
  const block = pythonSource.slice(startIdx, returnIdx).trimEnd();
  return block;
}

export async function loadWormArenaPromptTemplateBundle(): Promise<WormArenaPromptTemplateBundle> {
  const pythonSourcePath = resolveLlmPlayerPythonPath();

  if (!fs.existsSync(pythonSourcePath)) {
    throw new Error(`SnakeBench LLM player source file not found at: ${pythonSourcePath}`);
  }

  const pythonSource = await fs.promises.readFile(pythonSourcePath, 'utf8');
  const pythonPromptBuilderBlock = extractPythonPromptBuilderBlock(pythonSource);
  const appleTarget = await readAppleTargetFromPythonConstants();

  return {
    pythonSourcePath,
    pythonSource,
    pythonPromptBuilderBlock,
    canonicalTemplate: getCanonicalLlmPlayerPromptTemplate(),
    canonicalFixedLines: getCanonicalFixedLines(),
    appleTarget,
  };
}
