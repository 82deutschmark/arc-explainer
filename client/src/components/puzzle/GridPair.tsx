/**
 * GridPair.tsx
 *
 * Author: Cascade (DeepSeek R1)
 * Date: 2025-10-12
 * PURPOSE: Explicit input→output grid pair display with clear labeling
 * Handles single and multiple outputs with proper visual hierarchy
 * Replaces ambiguous arrow-only separation with explicit INPUT/OUTPUT badges
 * 
 * SRP/DRY check: Pass - Single responsibility (grid pair visualization)
 * DaisyUI: Pass - Uses DaisyUI badge component
 */

import React from 'react';
import { PuzzleGrid } from './PuzzleGrid';
import type { EmojiSet } from '@/lib/spaceEmojis';

interface GridPairProps {
  input: number[][];
  outputs: number[][][]; // Array of outputs for multi-output support
  title: string;
  showEmojis: boolean;
  emojiSet: EmojiSet;
  isTest?: boolean;
  compact?: boolean;
  maxWidth?: number;
  maxHeight?: number;
}

/**
 * Displays a grid transformation pair with explicit INPUT/OUTPUT labeling
 * Supports multiple outputs for test cases with 2+ outputs
 */
export function GridPair({
  input,
  outputs,
  title,
  showEmojis,
  emojiSet,
  isTest = false,
  compact = true,
  maxWidth = 180,
  maxHeight = 180
}: GridPairProps) {
  const hasMultipleOutputs = outputs.length > 1;

  return (
    <div 
      className={`border-2 rounded-lg overflow-hidden ${
        isTest ? 'border-green-500 bg-green-50' : 'border-base-300 bg-base-100'
      }`}
    >
      {/* Title Bar */}
      <div className={`px-2 py-1 text-xs font-semibold ${
        isTest ? 'bg-green-600 text-white' : 'bg-base-200 text-base-content'
      }`}>
        {title}
        {hasMultipleOutputs && (
          <span className="ml-2 badge badge-warning badge-xs">
            {outputs.length} outputs
          </span>
        )}
      </div>

      {/* Grid Display Area */}
      <div className="flex divide-x-2 divide-base-300">
        {/* INPUT Section */}
        <div className="flex-1 p-2 bg-blue-50">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-[10px] font-bold text-blue-700 uppercase">📋 Input</span>
          </div>
          <PuzzleGrid
            grid={input}
            title=""
            showEmojis={showEmojis}
            emojiSet={emojiSet}
            compact={compact}
            maxWidth={maxWidth}
            maxHeight={maxHeight}
          />
        </div>

        {/* OUTPUT Section(s) */}
        {outputs.map((output, idx) => (
          <div 
            key={idx}
            className={`flex-1 p-2 ${isTest ? 'bg-green-100' : 'bg-amber-50'}`}
          >
            <div className="flex items-center gap-1 mb-1">
              <span className={`text-[10px] font-bold uppercase ${
                isTest ? 'text-green-700' : 'text-amber-700'
              }`}>
                🎯 Output{hasMultipleOutputs ? ` ${idx + 1}` : ''}
              </span>
            </div>
            <PuzzleGrid
              grid={output}
              title=""
              showEmojis={showEmojis}
              emojiSet={emojiSet}
              compact={compact}
              maxWidth={maxWidth}
              maxHeight={maxHeight}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
