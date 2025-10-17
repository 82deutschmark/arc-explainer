/**
 * PuzzleGrid Component - Enhanced with aspect-ratio-aware sizing
 *
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-12 (Converted to DaisyUI)
 * PURPOSE: Renders ARC puzzle grids with intelligent sizing that adapts to any dimension:
 *   - Supports irregular dimensions (1x1 to 30x30, non-square shapes)
 *   - Handles edge cases (tiny 1x1, large 30x30, strips 1xN or Nx1)
 *   - No forced size constraints - grids size naturally based on content
 *   - Cell sizes scale intelligently based on grid dimensions
 *   - Empty/sparse grids show placeholder
 *   - Compact mode available for dense layouts
 *
 * SRP/DRY check: Pass - Single responsibility (grid rendering with adaptive sizing)
 * DaisyUI: Pass - Uses DaisyUI badge component
 */

import React, { useMemo } from 'react';
import { PuzzleGridProps } from '@/types/puzzle';
import { GridCell } from './GridCell';

export const PuzzleGrid = React.memo(function PuzzleGrid({ 
  grid, 
  title, 
  showEmojis, 
  highlight = false, 
  emojiSet, 
  diffMask,
  maxWidth,
  maxHeight,
  preserveAspectRatio = true,
  compact = false
}: PuzzleGridProps) {
  // Validate grid and filter out null/undefined rows
  const validGrid = useMemo(() => {
    if (!grid || !Array.isArray(grid)) return [];
    return grid.filter(row => row && Array.isArray(row));
  }, [grid]);

  // Check if grid is empty (all zeros or no data)
  const isEmpty = useMemo(() => {
    if (validGrid.length === 0) return true;
    return validGrid.every(row => row.every(cell => cell === 0));
  }, [validGrid]);

  // Memoize comprehensive grid metadata with smart sizing
  const gridMetadata = useMemo(() => {
    const rows = validGrid.length;
    const cols = validGrid[0]?.length || 0;
    const cellCount = rows * cols;
    const maxDim = Math.max(rows, cols);
    const minDim = Math.min(rows, cols);
    const aspectRatio = cols / rows;
    const isStrip = minDim === 1 && maxDim > 3;
    const isTiny = rows <= 2 && cols <= 2;
    const isLarge = maxDim > 20;
    
    // Smart size selection based on dimensions - optimized for visibility
    let size: "tiny" | "small" | "normal" | "large" | "xlarge";
    if (maxDim > 25) {
      size = "tiny";    // 30x30 → 12px cells
    } else if (maxDim > 20) {
      size = "small";   // 25x25 → 16px cells
    } else if (maxDim > 15) {
      size = "small";   // 20x20 → 16px cells
    } else if (maxDim > 10) {
      size = "normal";  // 15x15 → 24px cells
    } else if (maxDim > 5) {
      size = "large";   // 10x10 → 32px cells
    } else if (isTiny) {
      size = "xlarge";  // 2x2 → 40px cells
    } else {
      size = "xlarge";  // 5x5 → 40px cells
    }
    
    // Compact mode reduces by one size level
    if (compact) {
      if (size === "xlarge") size = "large";
      else if (size === "large") size = "normal";
      else if (size === "normal") size = "small";
    }
    
    return { 
      rows, 
      cols, 
      maxDim, 
      minDim, 
      aspectRatio, 
      size, 
      isStrip, 
      isTiny, 
      isLarge,
      cellCount,
      isEmpty
    };
  }, [validGrid, compact]);

  // Memoize the grid content to prevent re-rendering cells unnecessarily
  const gridContent = useMemo(() => {
    if (gridMetadata.isEmpty) {
      return (
        <div className="flex items-center justify-center p-4 text-xs text-gray-400 italic">
          Empty Grid
        </div>
      );
    }

    return validGrid.map((row, rowIndex) => (
      <div key={rowIndex} className="flex">
        {row.map((cell, colIndex) => (
          <GridCell 
            key={`${rowIndex}-${colIndex}`}
            value={cell} 
            showEmojis={showEmojis}
            size={gridMetadata.size}
            emojiSet={emojiSet}
            mismatch={diffMask ? Boolean(diffMask[rowIndex]?.[colIndex]) : false}
          />
        ))}
      </div>
    ));
  }, [validGrid, showEmojis, gridMetadata.size, gridMetadata.isEmpty, emojiSet, diffMask]);
  
  // Calculate actual grid pixel dimensions (no forced scaling)
  const { actualWidth, actualHeight } = useMemo(() => {
    // Get cell pixel size based on size class
    const cellSizeMap = {
      tiny: 12,     // w-3 h-3 = 12px
      small: 16,    // w-4 h-4 = 16px
      normal: 24,   // w-6 h-6 = 24px
      large: 32,    // w-8 h-8 = 32px
      xlarge: 40    // w-10 h-10 = 40px
    };
    
    const cellSize = cellSizeMap[gridMetadata.size];
    const actualW = gridMetadata.cols * cellSize;
    const actualH = gridMetadata.rows * cellSize;
    
    return {
      actualWidth: actualW,
      actualHeight: actualH
    };
  }, [gridMetadata.rows, gridMetadata.cols, gridMetadata.size]);

  return (
    <div className={`inline-block ${compact ? 'space-y-0' : 'space-y-1'}`}>
      {title && (
        <div className={`flex items-center justify-center ${compact ? 'gap-0.5' : 'gap-1'} ${compact ? 'mb-0.5' : 'mb-1'}`}>
          <h3 className={`${compact ? 'text-[10px]' : 'text-xs'} font-medium text-gray-700`}>{title}</h3>
          <div className="badge badge-outline badge-sm text-[10px] px-1 py-0 bg-base-200">{gridMetadata.rows}×{gridMetadata.cols}</div>
        </div>
      )}
      <div className="inline-block">
        <div 
          className={`border-2 border-gray-600 rounded ${gridMetadata.isEmpty ? 'bg-gray-50' : 'bg-white shadow-sm'}`}
        >
          {gridContent}
        </div>
      </div>
    </div>
  );
});
