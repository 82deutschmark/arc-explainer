/**
 * TestCaseGallery.tsx
 * 
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-11
 * PURPOSE: Layout orchestration for displaying multiple test cases.
 * Handles adaptive layouts (horizontal for 1-2 tests, vertical for 3+),
 * adaptive sizing based on test count, and zoom modal state management.
 * 
 * SRP/DRY check: Pass - Single responsibility: orchestrate test case display
 * shadcn/ui: Pass - Uses Badge component
 */

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { TestCaseCard } from './TestCaseCard';
import { TestCaseZoomModal } from './TestCaseZoomModal';
import type { ARCExample } from '@shared/types';

interface TestCaseGalleryProps {
  testCases: ARCExample[];
  showHeader?: boolean;
  showEmojis?: boolean;
}

/**
 * Adaptive gallery for test cases.
 * - Single test: Large grids, horizontal layout
 * - Dual test: Medium grids, horizontal layout
 * - 3+ tests: Smaller grids, vertical stack
 */
export function TestCaseGallery({
  testCases,
  showHeader = true,
  showEmojis = false
}: TestCaseGalleryProps) {
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);
  
  const isMultiTest = testCases.length > 1;
  const useCompactLayout = testCases.length > 2;

  // Adaptive grid sizing based on test count
  const getSizeClass = (testCount: number): string => {
    if (testCount === 1) {
      return 'max-w-[24rem] max-h-[24rem]';  // Large for single test
    } else if (testCount === 2) {
      return 'max-w-[16rem] max-h-[16rem]';  // Medium for dual test
    } else {
      return 'max-w-[12rem] max-h-[12rem]';  // Smaller for multi-test
    }
  };

  const sizeClass = getSizeClass(testCases.length);

  // Adaptive container layout
  const containerClass = useCompactLayout
    ? 'flex flex-col gap-3'          // Vertical stack for 3+ tests
    : 'flex flex-row flex-wrap gap-8'; // Horizontal for 1-2 tests

  return (
    <div>
      {showHeader && (
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-base font-semibold">Test Cases</h3>
          <Badge variant="outline" className="text-xs">
            {testCases.length} {testCases.length === 1 ? 'test' : 'tests'}
          </Badge>
        </div>
      )}

      {/* Adaptive layout container */}
      <div className={containerClass}>
        {testCases.map((testCase, index) => (
          <TestCaseCard
            key={index}
            input={testCase.input}
            output={testCase.output}
            index={index}
            isMultiTest={isMultiTest}
            totalTests={testCases.length}
            sizeClass={sizeClass}
            useCompactLayout={useCompactLayout}
            onZoom={() => setZoomedIndex(index)}
          />
        ))}
      </div>

      {/* Zoom modal */}
      {zoomedIndex !== null && (
        <TestCaseZoomModal
          isOpen={true}
          onClose={() => setZoomedIndex(null)}
          input={testCases[zoomedIndex].input}
          output={testCases[zoomedIndex].output}
          index={zoomedIndex}
          isMultiTest={isMultiTest}
          showEmojis={showEmojis}
        />
      )}
    </div>
  );
}
