/**
 * GridCell Component
 * Renders a single cell in a puzzle grid with either numeric value or emoji
 * Author: Cascade
 */

import React from 'react';
import { GridCellProps, SIZE_CLASSES } from '@/types/puzzle';
import { ARC_COLORS } from '@/constants/colors';
import { getSpaceEmoji } from '@/lib/spaceEmojis';

export function GridCell({ value, showEmojis, size = "normal", emojiSet, mismatch }: GridCellProps) {
  return (
    <div className="relative">
      <div
        className={`${SIZE_CLASSES[size]} border border-gray-300 flex items-center justify-center font-mono`}
        style={{ 
          backgroundColor: showEmojis ? 'white' : (ARC_COLORS[value] || '#FFFFFF'),
          color: showEmojis ? '#000' : '#FFF'
        }}
      >
        {showEmojis ? getSpaceEmoji(value, emojiSet) : value}
      </div>
      {mismatch && (
        <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          {/* High-contrast bullseye marker */}
          <span className="relative inline-flex items-center justify-center">
            <span className="block w-3.5 h-3.5 rounded-full bg-black/80 ring-2 ring-white shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"></span>
            <span className="absolute block w-2 h-2 rounded-full bg-white/95 ring-1 ring-black/60"></span>
          </span>
        </span>
      )}
    </div>
  );
}
