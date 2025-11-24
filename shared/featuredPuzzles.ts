/**
 * Author: OpenAI Codex Agent
 * Date: 2025-11-23
 * PURPOSE: Single source of truth for the curated set of ten featured ARC puzzles
 *          (IDs and short notes). This module is intentionally standalone so it
 *          can be imported by client/server code without additional dependencies.
 * SRP/DRY check: Pass — extracted constants to avoid duplication across pages.
 */

export type FeaturedPuzzle = {
  id: string;
  note: string;
};

// Tweet-aligned curated list (see CHANGELOG 5.17.9 and PuzzleBrowser)
export const FEATURED_PUZZLE_IDS = [
  '65b59efc',
  'e3721c99',
  'dd6b8c4b',
  '2ba387bc',
  '14754a24',
  'b457fec5',
  '891232d6',
  '7b5033c1',
  '981571dc',
  '136b0064',
] as const;

// Short team notes per puzzle, used in featured galleries or annotations.
export const FEATURED_PUZZLE_NOTES: Record<string, string> = {
  '65b59efc':
    'ARC v2 task highlighted as clear evidence of complexity scaling over ARC v1.',
  'e3721c99':
    'ARC v2 task highlighted as clear evidence of complexity scaling over ARC v1.',
  'dd6b8c4b':
    'ARC v2 task highlighted as clear evidence of complexity scaling over ARC v1.',
  '2ba387bc':
    'Fast, efficient ARC v2 solve (Gemini 3 Pro ~772 tokens in ~188s vs humans ~147s).',
  '14754a24':
    'ARC v1 task used as a surprising failure example despite strong v2 performance.',
  'b457fec5':
    'ARC v1 “obvious miss” example still failed by some reasoning systems.',
  '891232d6':
    'ARC v1 task called out where reasoning systems still fail despite relative simplicity.',
  '7b5033c1':
    'Reasoning-effort case: Gemini 3 Pro solved with ~2k tokens; DeepThinker failed after ~300k.',
  '981571dc':
    'Efficiency contrast: both solved; Gemini ~7.6k tokens vs DeepThinker ~1.4M (>100× efficiency).',
  '136b0064':
    'Additional curated puzzle chosen for visual variety in the featured gallery.',
};

// Convenient array of { id, note } objects for easy consumption.
export const FEATURED_PUZZLES: FeaturedPuzzle[] = (
  FEATURED_PUZZLE_IDS as readonly string[]
).map((id) => ({ id, note: FEATURED_PUZZLE_NOTES[id] ?? '' }));

// Helper function for callers that prefer a function API.
export function getFeaturedPuzzles(): FeaturedPuzzle[] {
  return FEATURED_PUZZLES;
}

