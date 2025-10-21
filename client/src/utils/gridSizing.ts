/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-20
 * PURPOSE: Intelligent grid sizing utility that handles extreme aspect ratios.
 * Calculates optimal container dimensions based on grid content, viewport space,
 * and aspect ratio while avoiding unnecessary scrollbars and wasted space.
 * Used by GridDisplay, TestCaseCard, PredictionCard, and PuzzleGridDisplay.
 * SRP/DRY check: Pass - Single responsibility (sizing calculations), reusable utility
 */

export interface GridDimensions {
  rows: number;
  cols: number;
}

export interface SizingConstraints {
  /** Maximum width in pixels (default: viewport width - padding) */
  maxWidth?: number;
  /** Maximum height in pixels (default: viewport height - padding) */
  maxHeight?: number;
  /** Minimum cell size in pixels (default: 12) */
  minCellSize?: number;
  /** Maximum cell size in pixels (default: 40) */
  maxCellSize?: number;
  /** Preferred cell size in pixels (overrides calculated size) */
  preferredCellSize?: number;
}

export interface GridSize {
  /** Container width in pixels */
  width: number;
  /** Container height in pixels */
  height: number;
  /** Cell size in pixels */
  cellSize: number;
  /** Tailwind size class for cells */
  sizeClass: "tiny" | "small" | "normal" | "large" | "xlarge";
}

/**
 * Calculate optimal grid container size based on content and constraints.
 * Intelligently handles extreme aspect ratios (very wide or very tall grids).
 */
export function calculateGridSize(
  grid: GridDimensions,
  constraints: SizingConstraints = {}
): GridSize {
  const {
    maxWidth = typeof window !== 'undefined' ? window.innerWidth - 64 : 1200,
    maxHeight = typeof window !== 'undefined' ? window.innerHeight - 200 : 800,
    minCellSize = 12,
    maxCellSize = 40,
    preferredCellSize,
  } = constraints;

  const { rows, cols } = grid;
  const aspectRatio = cols / rows;
  const maxDim = Math.max(rows, cols);

  // Determine optimal cell size based on grid dimensions
  let cellSize: number;
  let sizeClass: "tiny" | "small" | "normal" | "large" | "xlarge";

  if (preferredCellSize) {
    cellSize = preferredCellSize;
    sizeClass = getCellSizeClass(cellSize);
  } else {
    // Smart cell size selection matching PuzzleGrid logic
    if (maxDim > 25) {
      cellSize = 12;
      sizeClass = "tiny";
    } else if (maxDim > 20) {
      cellSize = 16;
      sizeClass = "small";
    } else if (maxDim > 15) {
      cellSize = 16;
      sizeClass = "small";
    } else if (maxDim > 10) {
      cellSize = 24;
      sizeClass = "normal";
    } else if (maxDim > 5) {
      cellSize = 32;
      sizeClass = "large";
    } else {
      cellSize = 40;
      sizeClass = "xlarge";
    }
  }

  // Calculate natural dimensions
  let width = cols * cellSize;
  let height = rows * cellSize;

  // Handle extreme aspect ratios intelligently
  const isVeryWide = aspectRatio > 3; // More than 3:1 width to height
  const isVeryTall = aspectRatio < 0.33; // More than 3:1 height to width

  if (isVeryWide) {
    // For very wide grids, prioritize width and scale down if needed
    if (width > maxWidth) {
      const scale = maxWidth / width;
      width = maxWidth;
      height = height * scale;
      cellSize = Math.max(minCellSize, Math.floor(cellSize * scale));
    }
  } else if (isVeryTall) {
    // For very tall grids, prioritize height and scale down if needed
    if (height > maxHeight) {
      const scale = maxHeight / height;
      height = maxHeight;
      width = width * scale;
      cellSize = Math.max(minCellSize, Math.floor(cellSize * scale));
    }
  } else {
    // For standard aspect ratios, scale proportionally to fit both dimensions
    if (width > maxWidth || height > maxHeight) {
      const scaleX = maxWidth / width;
      const scaleY = maxHeight / height;
      const scale = Math.min(scaleX, scaleY);

      width = width * scale;
      height = height * scale;
      cellSize = Math.max(minCellSize, Math.floor(cellSize * scale));
    }
  }

  // Ensure cell size is within bounds
  cellSize = Math.max(minCellSize, Math.min(maxCellSize, cellSize));
  sizeClass = getCellSizeClass(cellSize);

  // Recalculate exact dimensions with bounded cell size
  width = cols * cellSize;
  height = rows * cellSize;

  return {
    width: Math.round(width),
    height: Math.round(height),
    cellSize,
    sizeClass,
  };
}

/**
 * Calculate optimal size for a pair of grids (input/output) displayed side-by-side.
 */
export function calculateGridPairSize(
  inputGrid: GridDimensions,
  outputGrid: GridDimensions,
  constraints: SizingConstraints = {}
): { input: GridSize; output: GridSize; containerWidth: number } {
  const {
    maxWidth = typeof window !== 'undefined' ? window.innerWidth - 64 : 1200,
    maxHeight = typeof window !== 'undefined' ? window.innerHeight - 200 : 800,
  } = constraints;

  // Calculate individual grid sizes
  const inputSize = calculateGridSize(inputGrid, { ...constraints, maxWidth: maxWidth / 2 - 32 });
  const outputSize = calculateGridSize(outputGrid, { ...constraints, maxWidth: maxWidth / 2 - 32 });

  // Use consistent cell size for both grids (smallest of the two)
  const uniformCellSize = Math.min(inputSize.cellSize, outputSize.cellSize);
  const uniformSizeClass = getCellSizeClass(uniformCellSize);

  const input: GridSize = {
    width: inputGrid.cols * uniformCellSize,
    height: inputGrid.rows * uniformCellSize,
    cellSize: uniformCellSize,
    sizeClass: uniformSizeClass,
  };

  const output: GridSize = {
    width: outputGrid.cols * uniformCellSize,
    height: outputGrid.rows * uniformCellSize,
    cellSize: uniformCellSize,
    sizeClass: uniformSizeClass,
  };

  const containerWidth = input.width + output.width + 64; // Include padding/gap

  return { input, output, containerWidth };
}

/**
 * Get Tailwind size class based on cell size in pixels.
 */
function getCellSizeClass(cellSize: number): "tiny" | "small" | "normal" | "large" | "xlarge" {
  if (cellSize <= 12) return "tiny";
  if (cellSize <= 16) return "small";
  if (cellSize <= 24) return "normal";
  if (cellSize <= 32) return "large";
  return "xlarge";
}

/**
 * Calculate responsive container classes based on grid classification.
 * Returns Tailwind classes for optimal layout based on grid characteristics.
 */
export function getResponsiveContainerClasses(
  grids: GridDimensions[],
  classification: "standard" | "wide" | "tall"
): string {
  const baseClasses = "w-full";

  if (classification === "wide") {
    // Very wide grids: allow horizontal layout, use full width
    return `${baseClasses} overflow-x-auto`;
  }

  if (classification === "tall") {
    // Very tall grids: allow vertical scroll, constrain height
    return `${baseClasses} overflow-y-auto max-h-[80vh]`;
  }

  // Standard grids: responsive grid layout
  const gridCount = grids.length;
  let gridCols = "grid-cols-1";

  if (gridCount >= 4) {
    gridCols = "grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";
  } else if (gridCount >= 3) {
    gridCols = "grid-cols-1 lg:grid-cols-2 xl:grid-cols-3";
  } else if (gridCount >= 2) {
    gridCols = "grid-cols-1 lg:grid-cols-2";
  }

  return `${baseClasses} grid ${gridCols} gap-4`;
}
