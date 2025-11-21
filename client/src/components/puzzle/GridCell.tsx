/**
 * GridCell Component
 * Renders a single cell in a puzzle grid with either numeric value or emoji
 * Optimized with React.memo to prevent unnecessary re-renders
 * Author: Cascade
 */

import React, { useMemo } from 'react';
import { GridCellProps, SIZE_CLASSES } from '@/types/puzzle';
import { ARC_COLORS } from '@/constants/colors';
import { getSpaceEmoji } from '@/lib/spaceEmojis';

export const GridCell = React.memo(function GridCell({
  value,
  showEmojis,
  showColorOnly = false,
  size = "normal",
  emojiSet,
  mismatch
}: GridCellProps) {
  const hideNumbers = showColorOnly && !showEmojis;

  // Memoize style calculations to avoid recalculating on every render
  const cellStyle = useMemo(() => {
    if (showEmojis) {
      return { backgroundColor: 'white', color: '#000' };
    }

    // Use appropriate text colors for good contrast
    let textColor = '#FFF'; // default white
    if (value === 4) textColor = '#000'; // yellow background - use black text
    if (value === 5) textColor = '#FFD700'; // grey background - use yellowish text
    if (value === 8) textColor = '#000'; // light blue background - use black text

    return {
      backgroundColor: ARC_COLORS[value] || '#FFFFFF',
      color: hideNumbers ? 'transparent' : textColor
    };
  }, [showEmojis, value, hideNumbers]);

  // Memoize cell content to avoid recalculating emoji/value
  const cellContent = useMemo(() => {
    if (showEmojis) {
      return getSpaceEmoji(value, emojiSet);
    }

    if (hideNumbers) {
      return null;
    }

    return value;
  }, [showEmojis, hideNumbers, value, emojiSet]);

  return (
    <div className="relative">
      <div
        className={`${SIZE_CLASSES[size]} border border-gray-300 flex items-center justify-center font-mono`}
        style={cellStyle}
        aria-label={hideNumbers ? `Grid color ${value}` : undefined}
      >
        {cellContent}
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
});
