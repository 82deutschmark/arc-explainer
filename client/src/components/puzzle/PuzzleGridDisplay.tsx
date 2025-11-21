/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-31
 * PURPOSE: Responsive puzzle grid display with dynamic sizing and multi-column layout.
 *          Uses viewport-relative sizing and CSS Grid to efficiently utilize horizontal space.
 *          Maintains simple input→output flow with adaptive grid arrangement for different screen sizes.
 * SRP/DRY check: Pass — prepares example metadata and renders it with the shared PuzzleGrid.
 */

import React, { useMemo } from 'react';
import { Grid3X3 } from 'lucide-react';
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import type { ARCTask, ARCExample } from '@shared/types';
import type { EmojiSet } from '@/lib/spaceEmojis';

interface PuzzleGridDisplayProps {
  task: ARCTask;
  showEmojis: boolean;
  showColorOnly: boolean;
  emojiSet: EmojiSet;
}

interface PreparedExample {
  key: string;
  label: string;
  dimensions: string;
  example: ARCExample;
}

// Increased max sizing values to better utilize horizontal space
// These are now 70-80% larger than original values to reduce wasted space
// Small grids (largestDim ≤ 18): 380px (was 220px)
// Medium grids (largestDim ≤ 25): 440px (was 260px)
// Large grids (largestDim > 25): 540px (was 320px)
const BASE_MAX_WIDTH = 380;
const BASE_MAX_HEIGHT = 380;
const LARGE_MAX_WIDTH = 440;
const LARGE_MAX_HEIGHT = 460;
const XL_MAX_WIDTH = 540;
const XL_MAX_HEIGHT = 560;

function formatDimensions(example: ARCExample): string {
  const inputRows = example.input.length;
  const inputCols = example.input[0]?.length ?? 0;
  const outputRows = example.output.length;
  const outputCols = example.output[0]?.length ?? 0;
  return `${inputRows}×${inputCols} → ${outputRows}×${outputCols}`;
}

function determineBounds(example: ARCExample) {
  const maxRows = Math.max(example.input.length, example.output.length);
  const maxCols = Math.max(example.input[0]?.length ?? 0, example.output[0]?.length ?? 0);
  const largestDimension = Math.max(maxRows, maxCols);

  if (largestDimension > 25) {
    return { maxWidth: XL_MAX_WIDTH, maxHeight: XL_MAX_HEIGHT };
  }

  if (largestDimension > 18) {
    return { maxWidth: LARGE_MAX_WIDTH, maxHeight: LARGE_MAX_HEIGHT };
  }

  return { maxWidth: BASE_MAX_WIDTH, maxHeight: BASE_MAX_HEIGHT };
}

function prepareExamples(examples: ARCExample[], variant: 'train' | 'test'): PreparedExample[] {
  return examples.map((example, index) => ({
    key: `${variant}-${index}`,
    label: variant === 'train' ? `Training Example ${index + 1}` : `Test ${index + 1}`,
    dimensions: formatDimensions(example),
    example
  }));
}

interface ExampleSectionProps {
  title: string;
  accentClass: string;
  emptyMessage: string;
  examples: PreparedExample[];
  variant: 'train' | 'test';
  showEmojis: boolean;
  showColorOnly: boolean;
  emojiSet: EmojiSet;
}

interface ExampleCardProps {
  prepared: PreparedExample;
  variant: 'train' | 'test';
  showEmojis: boolean;
  showColorOnly: boolean;
  emojiSet: EmojiSet;
}

function ExampleCard({ prepared, variant, showEmojis, showColorOnly, emojiSet }: ExampleCardProps) {
  const { example, label, dimensions } = prepared;
  const bounds = determineBounds(example);
  const inputTitle = variant === 'train' ? 'Input' : 'Test Input';
  const outputTitle = variant === 'train' ? 'Output' : 'Expected Output';

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        <span>{label}</span>
        <span className="font-normal text-[10px] text-slate-400 normal-case">{dimensions}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-start gap-3">
        <PuzzleGrid
          grid={example.input}
          title={inputTitle}
          showEmojis={showEmojis}
          showColorOnly={showColorOnly}
          emojiSet={emojiSet}
          compact
          maxWidth={bounds.maxWidth}
          maxHeight={bounds.maxHeight}
        />

        <div className="flex h-full items-center text-slate-400 text-xl leading-none">→</div>

        <PuzzleGrid
          grid={example.output}
          title={outputTitle}
          showEmojis={showEmojis}
          showColorOnly={showColorOnly}
          emojiSet={emojiSet}
          compact
          maxWidth={bounds.maxWidth}
          maxHeight={bounds.maxHeight}
        />
      </div>
    </div>
  );
}

function ExampleSection({
  title,
  accentClass,
  emptyMessage,
  examples,
  variant,
  showEmojis,
  showColorOnly,
  emojiSet
}: ExampleSectionProps) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1 mb-2">
        <span className={`inline-block w-1 h-1 rounded-full ${accentClass}`}></span>
        {title}
      </div>

      {examples.length === 0 ? (
        <div className="text-xs italic text-slate-400">{emptyMessage}</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-3">
          {examples.map((prepared) => (
            <ExampleCard
              key={prepared.key}
              prepared={prepared}
              variant={variant}
              showEmojis={showEmojis}
              showColorOnly={showColorOnly}
              emojiSet={emojiSet}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PuzzleGridDisplay({ task, showEmojis, showColorOnly, emojiSet }: PuzzleGridDisplayProps) {
  const trainingExamples = useMemo(() => prepareExamples(task.train, 'train'), [task.train]);
  const testExamples = useMemo(() => prepareExamples(task.test, 'test'), [task.test]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-4">
      <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
        <Grid3X3 className="h-4 w-4" />
        Puzzle Grids
        <span className="text-xs font-normal text-slate-500">
          ({task.train.length} train, {task.test.length} test)
        </span>
      </div>

      <ExampleSection
        title="Training Examples"
        accentClass="bg-blue-500"
        emptyMessage="No training data provided for this puzzle."
        examples={trainingExamples}
        variant="train"
        showEmojis={showEmojis}
        showColorOnly={showColorOnly}
        emojiSet={emojiSet}
      />

      <ExampleSection
        title="Test Cases"
        accentClass="bg-emerald-500"
        emptyMessage="No test cases available."
        examples={testExamples}
        variant="test"
        showEmojis={showEmojis}
        showColorOnly={showColorOnly}
        emojiSet={emojiSet}
      />
    </div>
  );
}
