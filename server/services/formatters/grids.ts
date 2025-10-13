/**
 * server/services/formatters/grids.ts
 * 
 * Grid formatting and emoji conversion utilities for ARC puzzles.
 * Extracted from promptBuilder.ts to separate concerns and enable reuse.
 * 
 * Key Features:
 * - Numeric to emoji grid conversion
 * - Multiple emoji palette support
 * - Training example formatting
 * - Test case formatting with optional answer inclusion
 * - Grid validation utilities
 * 
 * @author Claude Code  
 * @date August 22, 2025
 */

import { ARCTask } from "../../../shared/types";

/**
 * Server-side emoji palette registry.
 * Matches keys defined in `client/src/lib/spaceEmojis.ts`.
 * Default remains legacy_default for backward compatibility.
 */
export const EMOJI_PALETTES: Record<string, string[]> = {
  legacy_default: ['⬛', '✅', '👽', '👤', '🪐', '🌍', '🛸', '☄️', '♥️', '⚠️'],
  alien_language: ['🈵', '☮', '🈳', '🚯', '✴', '❗', '💹', '💟', '🔜', '🤗'],
  celestial_set1: ['⬛', '🌍', '🌎', '🌏', '⭐', '🌟', '✨', '💫', '🌠', '🪐'],
  celestial_set2: ['⬛', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '☀️'],
  tech_set1: ['⬛', '⚡', '🔋', '🔌', '⛽', '☢️', '⚛️', '🔗', '⚙️', '🔧'],
  tech_set2: ['⬛', '📡', '🛰️', '📱', '⌨️', '📶', '📋', '💻', '🎚️', '🎧'],
  nav_alerts: ['⬛', '⬆️', '⬇️', '⬅️', '➡️', '↗️', '↖️', '↘️', '↙️', '🧭'],
  status_alerts: ['⬛', '✅', '❌', '⚠️', '🚨', '🦺', '🔥', '❄️', '📍', '🎯'],
  weather_climate: ['⬛', '🌞', '🌝', '🌛', '🌜', '🌧️', '⛈️', '🌩️', '🌨️', '❄️'],
  status_emojis: ['⬛', '😂', '😶', '😐', '🙄', '😴', '😵', '🤗', '🤔', '😣'],
  ai_emojis: ['⬛', '🤖', '💡', '🧠', '🔗', '⚙️', '🔧', '🔄', '⚡', '🚫'],
  vague_symbols: ['⬛', '♊', '💕', '💢', '🆎', '🆒', '🈚', '🛃', '💠', '☣'],
  arc_colors: ['⬛', '🟦', '🟥', '🟩', '🟨', '⬜', '🟪', '🟧', '🟫', '🀄'],
  mahjong: ['⬛', '🀇', '🀈', '🀉', '🀊', '🀋', '🀌', '🀍', '🀎', '🀏'],
};

/**
 * Get emoji palette by key, with fallback to legacy_default
 */
export function getEmojiPalette(key?: string): string[] {
  if (key && EMOJI_PALETTES[key]) {
    return EMOJI_PALETTES[key];
  }
  return EMOJI_PALETTES.legacy_default;
}

/**
 * Convert numeric grid to emoji representation
 */
export function convertGridToEmojis(grid: number[][], emojiPalette: string[]): string[][] {
  return grid.map(row => 
    row.map(cell => emojiPalette[cell] ?? '❓')
  );
}

/**
 * Validate that a grid is properly formatted (2D array of integers 0-9)
 */
export function isValidGrid(grid: any): grid is number[][] {
  if (!Array.isArray(grid)) return false;
  
  for (const row of grid) {
    if (!Array.isArray(row)) return false;
    for (const cell of row) {
      if (!Number.isInteger(cell) || cell < 0 || cell > 9) return false;
    }
  }
  
  return true;
}

/**
 * Format training examples for prompts
 */
export function formatTrainingExamples(
  task: ARCTask, 
  useEmojis: boolean = false,
  emojiPalette?: string[]
): string {
  const palette = emojiPalette || getEmojiPalette();
  
  return task.train
    .map((example, i) => {
      if (useEmojis) {
        const emojiInput = convertGridToEmojis(example.input, palette);
        const emojiOutput = convertGridToEmojis(example.output, palette);
        return `Example ${i + 1}:\nInput: ${JSON.stringify(emojiInput)}\nOutput: ${JSON.stringify(emojiOutput)}`;
      } else {
        return `Example ${i + 1}:\nInput: ${JSON.stringify(example.input)}\nOutput: ${JSON.stringify(example.output)}`;
      }
    })
    .join("\n\n");
}

/**
 * Format test cases for prompts
 */
export function formatTestCases(
  task: ARCTask,
  useEmojis: boolean = false,
  emojiPalette?: string[],
  omitAnswer: boolean = true  // CRITICAL: Default is TRUE (hide answers for research integrity)
): { inputs: string[]; outputs: string[] } {
  const palette = emojiPalette || getEmojiPalette();
  const inputs: string[] = [];
  const outputs: string[] = [];
  
  for (const testCase of task.test) {
    if (useEmojis) {
      const emojiInput = convertGridToEmojis(testCase.input, palette);
      const emojiOutput = convertGridToEmojis(testCase.output, palette);
      inputs.push(JSON.stringify(emojiInput));
      outputs.push(JSON.stringify(emojiOutput));
    } else {
      inputs.push(JSON.stringify(testCase.input));
      outputs.push(JSON.stringify(testCase.output));
    }
  }
  
  return { inputs, outputs };
}

/**
 * Create emoji map legend for alien communication mode
 */
export function createEmojiMapLegend(emojiPalette: string[]): string {
  const mappings = emojiPalette.map((emoji, index) => `${index}: ${emoji}`).join('\n');
  
  return `
The aliens provided this emoji mapping for numbers 0-9:

${mappings}`;
}

/**
 * Format test cases with optional answer inclusion
 */
export function formatTestSection(
  task: ARCTask,
  useEmojis: boolean = false,
  emojiPalette?: string[],
  omitAnswer: boolean = true,  // CRITICAL: Default is TRUE (hide answers for research integrity)
  isSolverMode: boolean = false
): string {
  const testCases = formatTestCases(task, useEmojis, emojiPalette, omitAnswer);
  const isMultiTest = task.test.length > 1;
  
  if (isSolverMode) {
    // Solver mode: no answers provided
    return isMultiTest
      ? testCases.inputs
          .map((input, idx) => `Test ${idx + 1} Input: ${input}`)
          .join("\n\n")
      : `Input: ${testCases.inputs[0]}`;
  } else {
    // Explanation mode: answers provided (unless explicitly omitted)
    if (omitAnswer) {
      return isMultiTest
        ? testCases.inputs
            .map((input, idx) => `Test ${idx + 1} Input: ${input}`)
            .join("\n\n")
        : `Input: ${testCases.inputs[0]}`;
    }
    
    return isMultiTest
      ? testCases.inputs
          .map((input, idx) => `Test ${idx + 1} Input: ${input}\nCorrect Answer: ${testCases.outputs[idx]}`)
          .join("\n\n")
      : `Input: ${testCases.inputs[0]}\nCorrect Answer: ${testCases.outputs[0]}`;
  }
}

/**
 * Get appropriate section labels based on mode and emoji usage
 */
export function getSectionLabels(
  useEmojis: boolean = false,
  isSolverMode: boolean = false,
  omitAnswer: boolean = false
): {
  trainingLabel: string;
  testLabel: string;
} {
  const trainingLabel = useEmojis 
    ? "TRAINING EXAMPLES (what the aliens taught us):"
    : "TRAINING EXAMPLES:";
    
  let testLabel: string;
  
  if (isSolverMode) {
    testLabel = "TEST CASE (predict the output):";
  } else if (omitAnswer) {
    testLabel = useEmojis
      ? "TEST CASE (the aliens' question; correct answer withheld):"
      : "TEST CASE (input only; correct answer withheld):";
  } else {
    testLabel = useEmojis
      ? "TEST CASE (the aliens' question and our correct answer):"
      : "TEST CASE (input and correct answer for analysis):";
  }
  
  return { trainingLabel, testLabel };
}

/**
 * Simple grid statistics for debugging
 */
export function getGridStats(grid: number[][]): {
  dimensions: [number, number];
  uniqueValues: number[];
  cellCount: number;
} {
  const rows = grid.length;
  const cols = rows > 0 ? grid[0].length : 0;
  const uniqueValues = [...new Set(grid.flat())].sort((a, b) => a - b);
  const cellCount = rows * cols;
  
  return {
    dimensions: [rows, cols],
    uniqueValues,
    cellCount
  };
}

/**
 * Compare two grids for equality
 */
export function gridsEqual(grid1: number[][], grid2: number[][]): boolean {
  if (grid1.length !== grid2.length) return false;
  
  for (let i = 0; i < grid1.length; i++) {
    const row1 = grid1[i];
    const row2 = grid2[i];
    
    if (row1.length !== row2.length) return false;
    
    for (let j = 0; j < row1.length; j++) {
      if (row1[j] !== row2[j]) return false;
    }
  }
  
  return true;
}