/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-21
 * PURPOSE: The figures, filters and checks behind the team's ARC-AGI-2 eval run pages, kept out
 *          of the components so they can be tested: which outputs a filter shows (solved, wrong
 *          answer, no answer, hit the token cap), the token sort, how this run compares with the
 *          per-output reference, a grid's shape, which cells of a same-shaped answer are wrong,
 *          and the find-in-reasoning match list (capped, so a one-letter search over a long trace
 *          can't flood the page with highlights).
 * SRP/DRY check: Pass - pure functions over the shapes in teamEvalsApi.ts; components in
 *          pages/team/Arc2Eval.tsx, Arc2Evals.tsx and EvalGrid.tsx. Mirrors
 *          components/teamRuns/runStats.ts for the eval pages.
 */

import type { EvalRow, Grid } from './teamEvalsApi';

export type EvalShow = 'all' | 'solved' | 'wrong' | 'none' | 'cap';
export type EvalSort = 'panel' | 'tokens-desc' | 'tokens-asc';

export const SHOW_OPTIONS: ReadonlyArray<readonly [EvalShow, string]> = [
  ['all', 'ALL'], ['solved', 'SOLVED'], ['wrong', 'WRONG ANSWER'], ['none', 'NO ANSWER'], ['cap', 'HIT CAP'],
];

/** Whether an output belongs under a filter. "No answer" covers outputs that never ran, too. */
export function rowShows(row: EvalRow, show: EvalShow): boolean {
  switch (show) {
    case 'solved': return row.correct === true;
    case 'wrong': return row.parsed === true && row.correct !== true;
    case 'none': return row.parsed !== true;
    case 'cap': return row.finish === 'length';
    default: return true;
  }
}

export function showCounts(rows: EvalRow[]): Record<EvalShow, number> {
  const counts = { all: 0, solved: 0, wrong: 0, none: 0, cap: 0 } as Record<EvalShow, number>;
  for (const row of rows) for (const [show] of SHOW_OPTIONS) if (rowShows(row, show)) counts[show] += 1;
  return counts;
}

/** Filter, then sort. "panel" keeps the publisher's order; token sorts put unknown counts last. */
export function visibleRows(rows: EvalRow[], show: EvalShow, sort: EvalSort): EvalRow[] {
  const shown = rows.filter((row) => rowShows(row, show));
  if (sort === 'panel') return shown;
  const sign = sort === 'tokens-desc' ? -1 : 1;
  return [...shown].sort((a, b) => {
    const ta = a.completionTokens ?? null;
    const tb = b.completionTokens ?? null;
    if (ta === null || tb === null) return ta === tb ? 0 : ta === null ? 1 : -1;
    return sign * (ta - tb);
  });
}

/** Against the per-output reference: what this run solves that the reference never did, and the reverse. */
export function referenceSplit(rows: EvalRow[]): { gained: number; lost: number; compared: number } {
  let gained = 0;
  let lost = 0;
  let compared = 0;
  for (const row of rows) {
    if (row.refSolved == null || !row.refRuns) continue;
    compared += 1;
    if (row.correct && row.refSolved === 0) gained += 1;
    if (!row.correct && row.refSolved > 0) lost += 1;
  }
  return { gained, lost, compared };
}

/** [rows, cols] of a well-formed grid (every row the same length, at least 1x1), else null. */
export function gridShape(grid: unknown): [number, number] | null {
  if (!Array.isArray(grid) || grid.length === 0) return null;
  const width = Array.isArray(grid[0]) ? grid[0].length : 0;
  if (width === 0) return null;
  for (const row of grid) if (!Array.isArray(row) || row.length !== width) return null;
  return [grid.length, width];
}

export const shapeText = (shape: readonly [number, number] | null | undefined) => (shape ? `${shape[0]}x${shape[1]}` : '?');

/** Wrong cells of an answer the same shape as the expected grid; null when shapes differ. */
export function wrongCells(expected: Grid | null | undefined, answer: Grid | null | undefined): { mask: boolean[][]; wrong: number } | null {
  const want = gridShape(expected);
  const got = gridShape(answer);
  if (!want || !got || want[0] !== got[0] || want[1] !== got[1]) return null;
  let wrong = 0;
  const mask = expected!.map((row, r) => row.map((cell, c) => {
    const bad = cell !== answer![r][c];
    if (bad) wrong += 1;
    return bad;
  }));
  return { mask, wrong };
}

/** Highlights stop here: enough to step through, few enough that the page stays quick. */
export const MAX_MATCHES = 2000;

/** Start offsets of a case-insensitive plain-text query in the text, at most `cap` of them. */
export function findMatches(text: string, query: string, cap = MAX_MATCHES): number[] {
  if (!query) return [];
  const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const found: number[] = [];
  for (let m = pattern.exec(text); m && found.length < cap; m = pattern.exec(text)) found.push(m.index);
  return found;
}

/** A model's reasoning is roughly four characters a token; the real count is the row's completionTokens. */
export const approxTokens = (chars: number) => Math.round(chars / 4);

export const count = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('en-US'));

/** "42s", "17m", "2.4h": wall-clock time as a person reads it. */
export function duration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  if (seconds < 90) return `${Math.round(seconds)}s`;
  if (seconds < 90 * 60) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

/** "+3", "−2", "±0": a difference in outputs solved. */
export const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n)}`;
