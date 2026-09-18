/*
 * Author: Claude Opus 5
 * Date: 2026-09-18
 * PURPOSE: One rule of a game, as a compact row inside a level section: a small colored
 *          category chip, the rule in one or two sentences, and where it was checked (the
 *          game-code lines, e.g. "dc22.py:10663-10708", in small monospace). No link: the game
 *          code lives in ARC's engine package, not in a repo we publish (brief amendment 4).
 * SRP/DRY check: Pass -- presentation of one MechanicPoint; the level grouping is
 *          shared/arc3Games/gameLevels.ts.
 */

import type { MechanicPoint } from '@shared/arc3Games';

/** Chip colors, one per category, so a reader scanning a level sees the kinds of rule at a glance. */
const CATEGORY_STYLES: Record<MechanicPoint['category'], string> = {
  controls: 'text-blue-700 border-blue-300 dark:text-blue-300 dark:border-blue-700',
  goal: 'text-amber-700 border-amber-300 dark:text-amber-300 dark:border-amber-700',
  pieces: 'text-violet-700 border-violet-300 dark:text-violet-300 dark:border-violet-700',
  hazards: 'text-red-700 border-red-300 dark:text-red-300 dark:border-red-700',
  budget: 'text-teal-700 border-teal-300 dark:text-teal-300 dark:border-teal-700',
  feedback: 'text-slate-600 border-slate-300 dark:text-slate-300 dark:border-slate-600',
  other: 'text-slate-600 border-slate-300 dark:text-slate-300 dark:border-slate-600',
};

export function MechanicRow({ point }: { point: MechanicPoint }) {
  return (
    <li className="grid grid-cols-[5.25rem_1fr] gap-x-3 gap-y-1 py-2.5 border-t first:border-t-0">
      <span
        className={`justify-self-start mt-0.5 rounded-sm border px-1.5 py-px text-[10px] font-bold uppercase tracking-wide ${CATEGORY_STYLES[point.category]}`}
      >
        {point.category}
      </span>
      <div className="min-w-0">
        <p className="text-sm leading-relaxed">{point.text}</p>
        {point.source && (
          <p className="mt-0.5 font-mono text-[11px] leading-snug text-muted-foreground break-words">
            {point.source}
          </p>
        )}
      </div>
    </li>
  );
}
