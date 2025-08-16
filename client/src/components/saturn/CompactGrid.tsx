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

type CompactGridProps = {
  grid: number[][];
  title?: string;
  size?: 'tiny' | 'small';
};

const COLOR_CLASSES = [
  'bg-zinc-800',   // 0
  'bg-blue-500',   // 1
  'bg-red-500',    // 2
  'bg-green-500',  // 3
  'bg-yellow-500', // 4
  'bg-purple-500', // 5
  'bg-pink-500',   // 6
  'bg-teal-500',   // 7
  'bg-orange-500', // 8
  'bg-cyan-500',   // 9
];

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
              const color = Number.isFinite(idx) && idx >= 0 && idx < COLOR_CLASSES.length
                ? COLOR_CLASSES[idx]
                : 'bg-gray-300';
              return (
                <div key={j} className={`${cellSize} ${color} border border-gray-300`} />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
