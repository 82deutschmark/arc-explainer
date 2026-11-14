/**
 * Author: Claude Sonnet 5.5; Claude Opus 5.5
 * Date: 14-Nov-2026
 * 14-Nov-2026 (Claude Opus 5.5): pickPuzzleOfTheDay says whether a null pick was a load failure, so the
 *          front-page card is not cached without its puzzle after a transient error.
 * PURPOSE: Picks the ARC puzzle drawn on the ARC Daily Digest's front-page share card: one real
 *          ARC-AGI-1 training pair per Eastern day, small enough to read at card scale. The pick
 *          depends only on the date, so the card's address (shared/news.ts sectionCardVersion,
 *          which includes the day) fully describes the picture. Returns null, never a made-up grid,
 *          when no suitable puzzle can be loaded; the card then simply leaves the figure out.
 * SRP/DRY check: Pass — selection only. Puzzle files and metadata come from puzzleLoader.ts;
 *          drawing stays in newsCardImage.ts. Checked ogImageService.ts: it composes whole-puzzle
 *          cards with sharp and has no reusable "pick one pair" step.
 */
import { puzzleLoader } from '../puzzleLoader';
import { logger } from '../../utils/logger';

export interface CardPuzzle { id: string; input: number[][]; output: number[][] }

/** Longest side allowed, so a grid stays at least ten pixels a cell inside the card's figure. */
const MAX_SIDE = 10;
/** A few neighbours are tried in order when the day's first pick is unusable (one grid, or a no-op pair). */
const TRIES = 8;
const DAY_MS = 86_400_000;

const isGrid = (value: unknown): value is number[][] =>
  Array.isArray(value) && value.length > 0 && value.every(row => Array.isArray(row) && row.length === value[0].length && row.length > 0 && row.every(cell => Number.isInteger(cell) && cell >= 0 && cell <= 9));
const sameGrid = (a: number[][], b: number[][]) => a.length === b.length && a.every((row, index) => row.every((cell, column) => cell === b[index][column]));

/** A day's pick. `failed` marks a null puzzle caused by an error (worth retrying), not by there being no suitable puzzle. */
export interface PuzzlePick { puzzle: CardPuzzle | null; failed: boolean }

/** The day's puzzle for an Eastern date like "2026-10-10", and whether picking it failed. */
export async function pickPuzzleOfTheDay(day: string): Promise<PuzzlePick> {
  try {
    const ids = puzzleLoader.getPuzzleList({ source: 'ARC1', maxGridSize: MAX_SIDE }).map(puzzle => puzzle.id);
    const dayNumber = Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
    if (!ids.length || !Number.isFinite(dayNumber)) return { puzzle: null, failed: false };
    for (let step = 0; step < Math.min(TRIES, ids.length); step++) {
      const id = ids[(dayNumber + step) % ids.length];
      const pair = (await puzzleLoader.loadPuzzle(id))?.train?.[0];
      if (pair && isGrid(pair.input) && isGrid(pair.output) && !sameGrid(pair.input, pair.output)) return { puzzle: { id, input: pair.input, output: pair.output }, failed: false };
    }
    return { puzzle: null, failed: false };
  } catch (error) {
    logger.error(`news og-image: could not pick the puzzle for ${day} - ${error instanceof Error ? error.message : String(error)}`, 'news');
    return { puzzle: null, failed: true };
  }
}

/** The day's puzzle for an Eastern date like "2026-10-10", or null when none could be picked. */
export async function puzzleOfTheDay(day: string): Promise<CardPuzzle | null> {
  return (await pickPuzzleOfTheDay(day)).puzzle;
}
