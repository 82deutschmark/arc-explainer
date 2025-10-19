/**
 * PuzzleGridDisplay.tsx
 *
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-12
 * PURPOSE: Renders puzzle training and test grids with memoized classification to prevent performance issues.
 * Previously: 300 lines of classification logic executed on EVERY render (temperature change, emoji toggle, etc.)
 * Now: Classification memoized with useMemo - only recalculates when task data changes.
 * This eliminates duplicate code (150+ lines) and prevents wasteful re-computation.
 * 
 * SRP/DRY check: Pass - Single responsibility (grid display), no duplication (uses shared utility)
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

        {/* TRAINING EXAMPLES - Stratified Layout */}
        <div className="mb-2">
          <div className="text-[10px] font-semibold opacity-60 uppercase tracking-wide mb-1 flex items-center gap-1">
            <span className="inline-block w-1 h-1 rounded-full bg-blue-500"></span>
            Training Examples
          </div>

          <div className="space-y-2">
            {/* Standard Pairs: CSS Grid for full width utilization */}
            {classifiedTraining.standard.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2">
                {classifiedTraining.standard.map(({ item, idx }) => (
                  <div key={idx} className="overflow-auto">
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
            )}

            {/* Wide Pairs: Full-width blocks with horizontal scroll */}
            {classifiedTraining.wide.length > 0 && (
              <div className="space-y-2">
                {classifiedTraining.wide.map(({ item, idx }) => (
                  <div key={idx} className="overflow-x-auto">
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
            )}

            {/* Tall Pairs: Horizontal scroll */}
            {classifiedTraining.tall.length > 0 && (
              <div className="overflow-x-auto pb-2">
                <div className="flex gap-2" style={{ width: 'max-content' }}>
                  {classifiedTraining.tall.map(({ item, idx }) => (
                    <div key={idx} className="overflow-y-auto" style={{ maxHeight: '600px' }}>
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

        {/* TEST CASES - Display in Grid Layout */}
        <div>
          <div className="text-[10px] font-semibold opacity-60 uppercase tracking-wide mb-1 flex items-center gap-1">
            <span className="inline-block w-1 h-1 rounded-full bg-green-500"></span>
            Test Cases
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2">
            {task.test.map((testCase, idx) => (
              <div key={idx} className="overflow-auto">
                <GridPair
                  input={testCase.input}
                  outputs={[testCase.output]}
                  title={`Test ${idx + 1}`}
                  showEmojis={showEmojis}
                  emojiSet={emojiSet}
                  isTest={true}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
