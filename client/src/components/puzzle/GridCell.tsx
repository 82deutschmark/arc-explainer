/**
 * GridCell Component
 * Renders a single cell in a puzzle grid with either numeric value or emoji
 * Author: Cascade
 */

import React from 'react';
import { GridCellProps, SIZE_CLASSES } from '@/types/puzzle';
import { CELL_COLORS } from '@/constants/models';
import { getSpaceEmoji } from '@/lib/spaceEmojis';

export function GridCell({ value, showEmojis, size = "normal" }: GridCellProps) {
  return (
    <div
      className={`${SIZE_CLASSES[size]} border border-gray-300 flex items-center justify-center font-mono`}
      style={{ 
        backgroundColor: showEmojis ? 'white' : (CELL_COLORS[value] || '#FFFFFF'),
        color: showEmojis ? '#000' : '#FFF'
      }}
    >
      {showEmojis ? getSpaceEmoji(value) : value}
    </div>
  );
}
