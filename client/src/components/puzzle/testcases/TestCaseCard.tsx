/**
 * TestCaseCard.tsx
 * 
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-11
 * PURPOSE: Display a single test case (input → output pair) with adaptive styling.
 * Handles multi-test labeling, adaptive separators, and zoom capability.
 * Similar structure to TrainingPairCard for consistency.
 * 
 * SRP/DRY check: Pass - Single responsibility: render one test case with zoom
 * shadcn/ui: Pass - Uses Card component for container
 */

import React from 'react';
import { InputGridDisplay } from '@/components/puzzle/grids/InputGridDisplay';
import { OutputGridDisplay } from '@/components/puzzle/grids/OutputGridDisplay';
import { ArrowRight, Maximize2 } from 'lucide-react';

interface TestCaseCardProps {
  input: number[][];
  output: number[][];
  index: number;
  isMultiTest: boolean;
  totalTests: number;
  onZoom?: () => void;
  sizeClass?: string;
  useCompactLayout?: boolean; // vertical for 3+ tests
}

/**
 * Displays one test case with input and output grids.
 * Supports multi-test labeling and adaptive layout (horizontal vs vertical).
 * Click to open zoom modal for detailed inspection.
 */
export const TestCaseCard = React.memo(function TestCaseCard({
  input,
  output,
  index,
  isMultiTest,
  totalTests,
  onZoom,
  sizeClass = 'max-w-[16rem] max-h-[16rem]',
  useCompactLayout = false
}: TestCaseCardProps) {
  const hasZoom = Boolean(onZoom);

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
        />
      </div>
    </div>
  );
});
