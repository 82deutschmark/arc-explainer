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
import { classifyGridPairs, type GridPair as GridPairType } from '@/utils/gridClassification';
import type { ARCTask } from '@shared/types';
import type { EmojiSet } from '@/lib/spaceEmojis';

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
export function PuzzleGridDisplay({ task, showEmojis, emojiSet }: PuzzleGridDisplayProps) {
  // PERFORMANCE FIX: Memoize training grid classification
  // Previously: Recalculated on every render (lines 344-471 in old PuzzleExaminer)
  const classifiedTraining = useMemo(() => {
    return classifyGridPairs(task.train.map(example => ({
      input: example.input,
      output: example.output
    })));
  }, [task.train]);

  // PERFORMANCE FIX: Memoize test grid classification (still used for training examples)
  const classifiedTest = useMemo(() => {
    return classifyGridPairs(task.test.map(testCase => ({
      input: testCase.input,
      output: testCase.output
    })));
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
            {/* Standard Pairs: Responsive grid - no overflow containers */}
            {classifiedTraining.standard.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2">
                {classifiedTraining.standard.map(({ item, idx }) => (
                  <GridPair
                    key={idx}
                    input={item.input}
                    outputs={[item.output]}
                    title={`Training Example ${idx + 1}`}
                    showEmojis={showEmojis}
                    emojiSet={emojiSet}
                    isTest={false}
                  />
                ))}
              </div>
            )}

            {/* Wide Pairs: Full-width stacked layout - no scrollbars needed */}
            {classifiedTraining.wide.length > 0 && (
              <div className="space-y-2 w-full">
                {classifiedTraining.wide.map(({ item, idx }) => (
                  <div key={idx} className="w-full flex justify-center">
                    <div className="max-w-full">
                      <GridPair
                        input={item.input}
                        outputs={[item.output]}
                        title={`Training Example ${idx + 1}`}
                        showEmojis={showEmojis}
                        emojiSet={emojiSet}
                        isTest={false}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tall Pairs: Horizontal flex layout with smart spacing */}
            {classifiedTraining.tall.length > 0 && (
              <div className="w-full">
                <div className="flex gap-2 flex-wrap justify-start">
                  {classifiedTraining.tall.map(({ item, idx }) => (
                    <div key={idx} className="flex-shrink-0">
                      <GridPair
                        input={item.input}
                        outputs={[item.output]}
                        title={`Training Example ${idx + 1}`}
                        showEmojis={showEmojis}
                        emojiSet={emojiSet}
                        isTest={false}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TEST CASES - Intelligent Layout based on Classification */}
        <div>
          <div className="text-[10px] font-semibold opacity-60 uppercase tracking-wide mb-1 flex items-center gap-1">
            <span className="inline-block w-1 h-1 rounded-full bg-green-500"></span>
            Test Cases
          </div>

          <div className="space-y-2">
            {/* Standard test cases: Responsive grid */}
            {classifiedTest.standard.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2">
                {classifiedTest.standard.map(({ item, idx }) => (
                  <GridPair
                    key={idx}
                    input={item.input}
                    outputs={[item.output]}
                    title={`Test ${task.test.findIndex(t => t.input === item.input) + 1}`}
                    showEmojis={showEmojis}
                    emojiSet={emojiSet}
                    isTest={true}
                  />
                ))}
              </div>
            )}

            {/* Wide test cases: Full-width stacked */}
            {classifiedTest.wide.length > 0 && (
              <div className="space-y-2 w-full">
                {classifiedTest.wide.map(({ item, idx }) => (
                  <div key={idx} className="w-full flex justify-center">
                    <div className="max-w-full">
                      <GridPair
                        input={item.input}
                        outputs={[item.output]}
                        title={`Test ${task.test.findIndex(t => t.input === item.input) + 1}`}
                        showEmojis={showEmojis}
                        emojiSet={emojiSet}
                        isTest={true}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tall test cases: Horizontal flex */}
            {classifiedTest.tall.length > 0 && (
              <div className="w-full">
                <div className="flex gap-2 flex-wrap justify-start">
                  {classifiedTest.tall.map(({ item, idx }) => (
                    <div key={idx} className="flex-shrink-0">
                      <GridPair
                        input={item.input}
                        outputs={[item.output]}
                        title={`Test ${task.test.findIndex(t => t.input === item.input) + 1}`}
                        showEmojis={showEmojis}
                        emojiSet={emojiSet}
                        isTest={true}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
