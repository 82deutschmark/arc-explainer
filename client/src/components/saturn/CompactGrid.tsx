/**
 * client/src/components/saturn/CompactGrid.tsx
 *
 * A minimal, compact grid renderer for ARC inputs/outputs with tiny cells.
 * Used on the Saturn Visual Solver page to display training/test examples
 * without overwhelming the layout.
 *
 * Author: Cascade (model: Cascade)
 */

import React from 'react';
import { ARC_COLORS } from '../../constants/colors';

type CompactGridProps = {
  grid: number[][];
  title?: string;
  size?: 'tiny' | 'small';
};

export default function CompactGrid({ grid, title, size = 'tiny' }: CompactGridProps) {
  const cellSize = size === 'tiny' ? 'w-2 h-2' : 'w-3 h-3';

  return (
    <div className="flex flex-col items-center gap-1">
      {title && <div className="text-xs font-medium text-gray-600">{title}</div>}
      <div className="grid gap-0.5 border border-gray-300 p-1 bg-white rounded">
        {grid.map((row, i) => (
          <div key={i} className="flex gap-0.5">
            {row.map((cell, j) => {
              const idx = Number(cell);
              const color = Number.isFinite(idx) && idx >= 0 && idx < ARC_COLORS.length
                ? ARC_COLORS[idx]
                : 'rgb(200, 200, 200)';
              return (
                <div
                  key={j}
                  className={`${cellSize} border border-gray-300`}
                  style={{ backgroundColor: color }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
