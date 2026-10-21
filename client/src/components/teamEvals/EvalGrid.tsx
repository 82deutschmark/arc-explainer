/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-21
 * PURPOSE: One small ARC grid on the dark eval-trace screen: a caption (label and shape) over the
 *          site's TinyGrid, sized so the longer side fits `maxPx` with cells no bigger than
 *          `cellMax`, hairline gaps between cells when they are big enough to keep them, and
 *          wrong cells ringed when a diff mask is given. A malformed grid (ragged rows, empty)
 *          says so instead of drawing something misleading, since the model's answer is
 *          whatever it wrote.
 * SRP/DRY check: Pass - layout around components/puzzle/TinyGrid.tsx (the colours and cells are
 *          its own); shape check from evalStats.ts; palette from teamRuns/terminal.tsx.
 */

import { TinyGrid } from '@/components/puzzle/TinyGrid';
import { T } from '@/components/teamRuns/terminal';
import { gridShape, shapeText } from './evalStats';

interface EvalGridProps {
  grid: unknown;
  label: string;
  maxPx?: number;
  cellMax?: number;
  mask?: boolean[][];
  tone?: string;
}

export function EvalGrid({ grid, label, maxPx = 150, cellMax = 14, mask, tone }: EvalGridProps) {
  const shape = gridShape(grid);
  const caption = (
    <div className="text-[10px] uppercase tracking-[0.5px] whitespace-nowrap" style={{ color: tone ?? T.dim }}>
      {label} <span style={{ color: T.dim }}>{shape ? shapeText(shape) : ''}</span>
    </div>
  );
  if (!shape) {
    return (
      <div className="inline-block align-top">
        {caption}
        <div className="px-1" style={{ color: T.down, border: `1px dashed ${T.rule}` }}>{grid == null ? 'NONE' : 'MALFORMED'}</div>
      </div>
    );
  }
  const [rows, cols] = shape;
  const cell = Math.max(2, Math.min(cellMax, Math.floor(maxPx / Math.max(rows, cols))));
  const gap = cell >= 6 ? 1 : 0;
  return (
    <div className="inline-block align-top">
      {caption}
      <div style={{ width: cols * cell + (cols - 1) * gap, border: `1px solid ${T.rule}` }}>
        <TinyGrid grid={grid as number[][]} diffMask={mask} style={{ gap, background: T.rule }} />
      </div>
    </div>
  );
}
