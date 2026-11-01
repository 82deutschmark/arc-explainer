/**
 * Author: Claude Sonnet 5.5 Low
 * Date: 30-Oct-2026
 * PURPOSE: The LOOK REGISTRY. A "look" is the module that draws a card face (front, back, front node tree for linting).
 *          Which look draws a card is DATA: the set registry (sets.ts, content/news/series.json) names a look key per
 *          season, and this table maps that key to the functions. Next year's set is a new series.json row; it needs a
 *          new entry here only when the design itself changes (add the key to SET_LOOKS in sets.ts as well).
 *          A look key with no entry here (a data row ahead of the code) falls back to the NEWEST registered look and
 *          warns once, so a card is never left undrawn.
 * SRP/DRY check: Pass. Only maps keys to the existing renderers; no drawing, no data decisions.
 *
 * CHANGELOG
 * 30-Oct-2026 v1 (Claude Sonnet 5.5 Low): first version; one look, topps86.
 */
import { front, frontBuffer, frontNode, finishCard, PAPER, type RenderOpts } from './render';
import { back } from './back';
import type { Node } from './kit';

export interface LookOpts extends RenderOpts {
  /** The already rendered front (for the reverse's miniature); the look renders it itself when absent. */
  frontBuffer?: Buffer;
}
export interface Look {
  key: string;
  /** The front as a 750 x 1050 PNG, corners rounded and flattened (opts.flatten). */
  front(model: any, opts?: LookOpts): Promise<Buffer>;
  /** The same, memoised across calls (the reverse and the share preview reuse it). */
  frontBuffer(model: any, opts?: LookOpts): Promise<Buffer>;
  /** The Satori tree of the front, for the wording lint. */
  frontNode(model: any, opts?: LookOpts): Promise<Node>;
  /** The reverse as a 750 x 1050 PNG, corners rounded like the front. */
  back(model: any, opts?: LookOpts): Promise<Buffer>;
}

const topps86: Look = {
  key: 'topps86',
  front, frontBuffer, frontNode,
  async back(model, opts = {}) {
    const flatten = opts.flatten === undefined ? PAPER : opts.flatten;
    const square = await back(model, { ...opts, format: 'png' });
    return finishCard(square, flatten, true);
  },
};

/** Registration order is age: the last entry is the newest look. */
export const LOOKS: Record<string, Look> = { topps86 };

const warned = new Set<string>();
/** The look for a set's `look` key; an unknown key warns once and uses the newest look. */
export function lookFor(key: string | null | undefined): Look {
  const hit = key ? LOOKS[key] : undefined;
  if (hit) return hit;
  const newest = Object.values(LOOKS)[Object.keys(LOOKS).length - 1];
  const label = String(key ?? '(none)');
  if (!warned.has(label)) { warned.add(label); console.warn(`[cardFace] no look registered for "${label}"; drawing with the newest look (${newest.key})`); }
  return newest;
}
