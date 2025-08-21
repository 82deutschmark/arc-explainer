/**
 * GridCell Component
 * Renders a single cell in a puzzle grid with either numeric value or emoji
 * Author: Cascade
 */

import React from 'react';
import { GridCellProps, SIZE_CLASSES } from '@/types/puzzle';
import { ARC_COLORS } from '@/constants/colors';
import { getSpaceEmoji } from '@/lib/spaceEmojis';

export function GridCell({ value, showEmojis, size = "normal", emojiSet }: GridCellProps) {
  return (
    <div
      className={`${SIZE_CLASSES[size]} border border-gray-300 flex items-center justify-center font-mono`}
      style={{ 
        backgroundColor: showEmojis ? 'white' : (ARC_COLORS[value] || '#FFFFFF'),
        color: showEmojis ? '#000' : '#FFF'
      }}
    >
      {showEmojis ? getSpaceEmoji(value, emojiSet) : value}
    </div>
  );
}
