/**
 * Author: Claude Sonnet 5.5
 * Date: 10-October-2026
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

/** The day's puzzle for an Eastern date like "2026-10-10". */
export async function puzzleOfTheDay(day: string): Promise<CardPuzzle | null> {
  try {
    const ids = puzzleLoader.getPuzzleList({ source: 'ARC1', maxGridSize: MAX_SIDE }).map(puzzle => puzzle.id);
    const dayNumber = Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
    if (!ids.length || !Number.isFinite(dayNumber)) return null;
    for (let step = 0; step < Math.min(TRIES, ids.length); step++) {
      const id = ids[(dayNumber + step) % ids.length];
      const pair = (await puzzleLoader.loadPuzzle(id))?.train?.[0];
      if (pair && isGrid(pair.input) && isGrid(pair.output) && !sameGrid(pair.input, pair.output)) return { id, input: pair.input, output: pair.output };
    }
  } catch (error) {
    logger.error(`news og-image: could not pick the puzzle for ${day} - ${error instanceof Error ? error.message : String(error)}`, 'news');
  }
  return null;
}
