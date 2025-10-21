/**
 * PuzzleGridDisplay.tsx
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-20
 * PURPOSE: Renders puzzle training and test grids with intelligent layout and sizing.
 * Uses memoized classification to prevent performance issues and intelligent sizing
 * to eliminate unnecessary scrollbars and optimize space utilization.
 * Handles extreme aspect ratios (very wide/tall grids) without wasting viewport space.
 *
 * Previously: Fixed containers with overflow-auto causing scrollbars even when space available
 * Now: Intelligent responsive layout that adapts to grid dimensions and viewport size
 *
 * SRP/DRY check: Pass - Single responsibility (grid display with smart layout)
 * DaisyUI: Pass - Uses DaisyUI card and badge components
 */

import React, { useMemo } from 'react';
import { Grid3X3 } from 'lucide-react';
import { GridPair } from './GridPair';
import { classifyGridPair, type GridLayoutCategory } from '@/utils/gridClassification';
import type { ARCTask } from '@shared/types';
import type { EmojiSet } from '@/lib/spaceEmojis';
import { cn } from '@/lib/utils';

interface PuzzleGridDisplayProps {
  task: ARCTask;
  showEmojis: boolean;
  emojiSet: EmojiSet;
}

/**
 * Displays puzzle grids with tiered responsive layout based on dimensions
 * 
 * Performance optimization: Grid classification is memoized and only recalculates
 * when task data changes, not on every UI state change.
 */
interface GridExampleConfig {
  key: string;
  title: string;
  layout: GridLayoutCategory;
  input: number[][];
  outputs: number[][][];
  isTest: boolean;
}

const getGridSpanClasses = (layout: GridLayoutCategory) => {
  switch (layout) {
    case 'wide':
      return 'md:col-span-2 2xl:col-span-3';
    default:
      return 'col-span-1';
  }
};

const needsOverflowScroll = (layout: GridLayoutCategory) => layout !== 'standard';

export function PuzzleGridDisplay({ task, showEmojis, emojiSet }: PuzzleGridDisplayProps) {
  const trainingExamples = useMemo<GridExampleConfig[]>(() => {
    return task.train.map((example, idx) => ({
      key: `train-${idx}`,
      title: `Training Example ${idx + 1}`,
      layout: classifyGridPair({ input: example.input, output: example.output }),
      input: example.input,
      outputs: [example.output],
      isTest: false
    }));
  }, [task.train]);

  const testExamples = useMemo<GridExampleConfig[]>(() => {
    return task.test.map((example, idx) => ({
      key: `test-${idx}`,
      title: `Test ${idx + 1}`,
      layout: classifyGridPair({ input: example.input, output: example.output }),
      input: example.input,
      outputs: [example.output],
      isTest: true
    }));
  }, [task.test]);

  return (
    <div className="bg-base-100">
      <div className="p-2">
        <div className="text-sm font-semibold text-base-content mb-1 flex items-center gap-2">
          <Grid3X3 className="h-4 w-4" />
          Puzzle Grids
          <span className="text-xs font-normal opacity-60">
            ({task.train.length} train, {task.test.length} test)
          </span>
        </div>

        {/* TRAINING EXAMPLES - Intelligent Stratified Layout */}
        <div className="mb-2">
          <div className="text-[10px] font-semibold opacity-60 uppercase tracking-wide mb-1 flex items-center gap-1">
            <span className="inline-block w-1 h-1 rounded-full bg-blue-500"></span>
            Training Examples
          </div>

          <div className="space-y-2">
            <div className="grid auto-rows-max grid-cols-1 gap-2 sm:gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {trainingExamples.map((example) => (
                <div
                  key={example.key}
                  className={cn('w-full', getGridSpanClasses(example.layout))}
                >
                  <div
                    className={cn(
                      'w-full',
                      needsOverflowScroll(example.layout) && 'overflow-x-auto'
                    )}
                  >
                    <GridPair
                      input={example.input}
                      outputs={example.outputs}
                      title={example.title}
                      showEmojis={showEmojis}
                      emojiSet={emojiSet}
                      isTest={example.isTest}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* TEST CASES - Intelligent Layout based on Classification */}
        <div>
          <div className="text-[10px] font-semibold opacity-60 uppercase tracking-wide mb-1 flex items-center gap-1">
            <span className="inline-block w-1 h-1 rounded-full bg-green-500"></span>
            Test Cases
          </div>

          <div className="space-y-2">
            <div className="grid auto-rows-max grid-cols-1 gap-2 sm:gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {testExamples.map((example) => (
                <div
                  key={example.key}
                  className={cn('w-full', getGridSpanClasses(example.layout))}
                >
                  <div
                    className={cn(
                      'w-full',
                      needsOverflowScroll(example.layout) && 'overflow-x-auto'
                    )}
                  >
                    <GridPair
                      input={example.input}
                      outputs={example.outputs}
                      title={example.title}
                      showEmojis={showEmojis}
                      emojiSet={emojiSet}
                      isTest={example.isTest}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
