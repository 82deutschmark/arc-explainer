/*
Author: Codex (GPT-6)
Date: 2026-09-14
PURPOSE: Match the four frozen contributed revisions' printed Z prompts without changing
their verified sources. The player keeps Space as an alias and moves host Undo to U.
SRP/DRY check: Pass — the shared predicate drives keyboard, deck and Help consistently.
*/
import { canonicalGameId } from './arc3PublicIds';
const AUTHORED_Z_GAMES = new Set(['g500', 'g502', 'g519', 'g542']);
export function usesAuthoredZKey(id: string | undefined): boolean {
  return id !== undefined && AUTHORED_Z_GAMES.has(canonicalGameId(id));
}
