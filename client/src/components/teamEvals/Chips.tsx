/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-21
 * PURPOSE: A run's configuration as a row of small "label value" chips on the dark eval screens
 *          (the model's mask, dense/KV precision, indexer, layout, lanes; the client's effort,
 *          token cap, attempts, seed). Whatever keys the publisher sends are shown, in its order,
 *          so a new setting needs no page change; values that are not plain text, numbers or
 *          booleans are left out rather than printed as [object Object].
 *          2026-10-21 (Claude Opus 5.5), the runs API: long values are clipped (full on hover), so
 *          an env switch holding a path cannot stretch a side-by-side arms table.
 * SRP/DRY check: Pass - presentation only; palette from teamRuns/terminal.tsx. Used by
 *          pages/team/Arc2Evals.tsx and Arc2Eval.tsx.
 */

import { T } from '@/components/teamRuns/terminal';

const shown = (value: unknown): value is string | number | boolean =>
  (typeof value === 'string' && value.trim() !== '') || (typeof value === 'number' && Number.isFinite(value)) || typeof value === 'boolean';

/** clip: longer values (a library path in an env switch) are cut to this many characters, in full on hover. */
export function Chips({ record, skip = [], clip = 64 }: { record: Record<string, unknown> | null | undefined; skip?: string[]; clip?: number }) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const entries = Object.entries(record).filter(([k, v]) => !skip.includes(k) && shown(v));
  if (!entries.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {entries.map(([k, v]) => {
        const text = String(v);
        return (
          <span key={k} className="px-1 whitespace-nowrap text-[11px]" style={{ border: `1px solid ${T.rule}` }}
                title={text.length > clip ? `${k} ${text}` : undefined}>
            <span style={{ color: T.dim }}>{k} </span>{text.length > clip ? `${text.slice(0, clip - 1)}…` : text}
          </span>
        );
      })}
    </span>
  );
}
