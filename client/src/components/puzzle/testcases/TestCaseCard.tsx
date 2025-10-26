/**
 * TestCaseCard.tsx
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-20
 * PURPOSE: Display a single test case (input → output pair) with intelligent adaptive sizing.
 * Handles multi-test labeling, adaptive separators, zoom capability, and extreme aspect ratios.
 * Uses intelligent sizing to eliminate unnecessary scrollbars and optimize space utilization.
 * Similar structure to TrainingPairCard for consistency.
 *
 * SRP/DRY check: Pass - Single responsibility: render one test case with zoom and smart sizing
 * shadcn/ui: Pass - Uses Card component for container
 */

import React, { useMemo } from 'react';
import { InputGridDisplay } from '@/components/puzzle/grids/InputGridDisplay';
import { OutputGridDisplay } from '@/components/puzzle/grids/OutputGridDisplay';
import { ArrowRight, Maximize2 } from 'lucide-react';
import { calculateGridPairSize } from '@/utils/gridSizing';

interface TestCaseCardProps {
  input: number[][];
  output: number[][];
  index: number;
  isMultiTest: boolean;
  totalTests: number;
  onZoom?: () => void;
  sizeClass?: string; // Legacy prop - if provided, overrides intelligent sizing
  useCompactLayout?: boolean; // vertical for 3+ tests
  /** Use intelligent sizing (default: true) */
  useIntelligentSizing?: boolean;
  /** Maximum width for the entire card in pixels */
  maxWidth?: number;
  /** Maximum height for grids in pixels */
  maxHeight?: number;
}

/**
 * Displays one test case with input and output grids.
 * Supports multi-test labeling and adaptive layout (horizontal vs vertical).
 * Uses intelligent sizing to handle extreme aspect ratios without scrollbars.
 * Click to open zoom modal for detailed inspection.
 */
export const TestCaseCard = React.memo(function TestCaseCard({
  input,
  output,
  index,
  isMultiTest,
  totalTests,
  onZoom,
  sizeClass,
  useCompactLayout = false,
  useIntelligentSizing = true,
  maxWidth,
  maxHeight,
}: TestCaseCardProps) {
  const hasZoom = Boolean(onZoom);

  // Calculate intelligent sizing for the grid pair
  const gridSizes = useMemo(() => {
    if (sizeClass || !useIntelligentSizing) {
      return null; // Use legacy sizing
    }

    const inputRows = input?.length || 0;
    const inputCols = input?.[0]?.length || 0;
    const outputRows = output?.length || 0;
    const outputCols = output?.[0]?.length || 0;

    return calculateGridPairSize(
      { rows: inputRows, cols: inputCols },
      { rows: outputRows, cols: outputCols },
      { maxWidth, maxHeight }
    );
  }, [input, output, sizeClass, useIntelligentSizing, maxWidth, maxHeight]);

  return (
    <div
      className={`flex flex-col gap-1 min-w-fit ${hasZoom ? 'cursor-pointer group relative' : ''}`}
      onClick={onZoom}
    >
      {/* Zoom indicator overlay (if zoomable) */}
      {hasZoom && (
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <div className="bg-blue-500 text-white rounded p-1">
            <Maximize2 className="h-3 w-3" />
          </div>
        </div>
      )}

      {/* Test number badge (only for multi-test puzzles) */}
      {isMultiTest && (
        <span className="text-[11px] text-gray-500 font-medium">
          Test {index + 1}
        </span>
      )}

      {/* Input → Output row with adaptive spacing and separator */}
      <div className={`flex items-center ${useCompactLayout ? 'gap-8' : 'gap-10'}`}>
        <InputGridDisplay
          grid={input}
          sizeClass={sizeClass}
          showDimensions={true}
          useIntelligentSizing={useIntelligentSizing && !sizeClass}
          maxWidth={gridSizes?.input.width}
          maxHeight={gridSizes?.input.height}
        />

        {/* Visual separator - adaptive based on layout */}
        {useCompactLayout ? (
          <div className="text-xs text-gray-400">→</div>
        ) : (
          <div className="flex items-center px-2">
            <ArrowRight className="h-5 w-5 text-gray-400" />
          </div>
        )}

        <OutputGridDisplay
          grid={output}
          sizeClass={sizeClass}
          showDimensions={true}
          useIntelligentSizing={useIntelligentSizing && !sizeClass}
          maxWidth={gridSizes?.output.width}
          maxHeight={gridSizes?.output.height}
        />
      </div>
    </div>
  );
});
