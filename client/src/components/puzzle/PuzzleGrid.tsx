/**
 * PuzzleGrid Component - Enhanced with aspect-ratio-aware sizing
 *
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-12 (Converted to DaisyUI)
 * PURPOSE: Renders ARC puzzle grids with intelligent sizing that adapts to:
 *   - Irregular dimensions (1x1 to 30x30, non-square shapes)
 *   - Edge cases (tiny 1x1, large 30x30, strips 1xN or Nx1)
 *   - Aspect ratio preservation within maxWidth/maxHeight constraints
 *   - Empty/sparse grids (collapse to placeholder)
 *   - Compact mode for dense layouts
 *
 * SRP/DRY check: Pass - Single responsibility (grid rendering with adaptive sizing)
 * DaisyUI: Pass - Uses DaisyUI badge component
 *
 * Integration: Used by PuzzleExaminer for training examples and test cases
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
    const isStrip = minDim === 1 && maxDim > 3; // Horizontal or vertical strip
    const isTiny = rows <= 2 && cols <= 2;
    const isLarge = maxDim > 20;
    
    // Smart size selection based on dimensions and context
    let size: "tiny" | "small" | "normal" | "large" | "xlarge";
    if (isLarge) {
      size = "tiny";    // 30x30 → 3px cells
    } else if (maxDim > 15) {
      size = "small";   // 20x20 → 4px cells
    } else if (maxDim > 10) {
      size = "small";   // 15x15 → 4px cells
    } else if (maxDim > 5) {
      size = "normal";  // 10x10 → 6px cells
    } else if (isTiny) {
      size = "xlarge";  // 2x2 → 10px cells
    } else {
      size = "large";   // 5x5 → 8px cells
    }
    
    // Apply compact override if requested
    if (compact && size === "xlarge") size = "large";
    if (compact && size === "large") size = "normal";
    
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
  
  // Calculate actual grid pixel dimensions and scale factor
  const { actualWidth, actualHeight, scaleFactor } = useMemo(() => {
    // Get cell pixel size based on size class
    const cellSizeMap = {
      tiny: 12,     // w-3 h-3 = 12px (0.75rem)
      small: 16,    // w-4 h-4 = 16px (1rem)
      normal: 24,   // w-6 h-6 = 24px (1.5rem)
      large: 32,    // w-8 h-8 = 32px (2rem)
      xlarge: 40    // w-10 h-10 = 40px (2.5rem)
    };
    
    const cellSize = cellSizeMap[gridMetadata.size];
    const actualW = gridMetadata.cols * cellSize;
    const actualH = gridMetadata.rows * cellSize;
    
    // Calculate scale factor if constraints exist
    let scale = 1;
    if (maxWidth && actualW > maxWidth) {
      scale = Math.min(scale, maxWidth / actualW);
    }
    if (maxHeight && actualH > maxHeight) {
      scale = Math.min(scale, maxHeight / actualH);
    }
    
    return {
      actualWidth: actualW,
      actualHeight: actualH,
      scaleFactor: scale
    };
  }, [gridMetadata.rows, gridMetadata.cols, gridMetadata.size, maxWidth, maxHeight]);

  return (
    <div 
      className={`text-center ${highlight ? 'bg-green-50 p-1 rounded border border-green-300' : ''} ${compact ? 'space-y-0' : 'space-y-1'}`}
      style={{
        maxWidth: maxWidth ? `${maxWidth}px` : undefined,
        maxHeight: maxHeight ? `${maxHeight}px` : undefined
      }}
    >
      <div className={`flex items-center justify-center ${compact ? 'gap-0.5' : 'gap-1'} ${compact ? 'mb-0.5' : 'mb-1'}`}>
        <h3 className={`${compact ? 'text-[10px]' : 'text-xs'} font-medium text-gray-700`}>{title}</h3>
        <div className="badge badge-outline badge-sm text-[10px] px-1 py-0 bg-base-200">{gridMetadata.rows}×{gridMetadata.cols}</div>
      </div>
      <div 
        className={`inline-block border ${compact ? 'border-gray-300' : 'border-gray-400'} rounded ${gridMetadata.isEmpty ? 'bg-gray-50' : ''} origin-top-left`}
        style={{
          transform: scaleFactor < 1 ? `scale(${scaleFactor})` : undefined,
          transformOrigin: 'top left'
        }}
      >
        {gridContent}
      </div>
    </div>
  );
});
