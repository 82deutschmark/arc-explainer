/**
 * GridPair.tsx
 *
 * Author: Cascade (DeepSeek R1)
 * Date: 2025-10-12
 * PURPOSE: Explicit input→output grid pair display with clear labeling and strong visual distinction.
 * Handles single and multiple outputs with proper visual hierarchy.
 * Uses high-contrast colors (blue for input, yellow/green for output) to eliminate confusion.
 * Removed hardcoded size constraints to support grids of any dimension (2x2 to 30x30).
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
  isTest = false
}: GridPairProps) {
  const hasMultipleOutputs = outputs.length > 1;

  return (
    <div 
      className={`inline-block border-3 rounded-lg overflow-visible shadow-md ${
        isTest ? 'border-green-600 bg-base-100' : 'border-blue-600 bg-base-100'
      }`}
      style={{ minWidth: 'fit-content' }}
    >
      {/* Title Bar */}
      <div className={`px-3 py-2 text-sm font-bold ${
        isTest ? 'bg-green-700 text-white' : 'bg-blue-700 text-white'
      }`}>
        {title}
        {hasMultipleOutputs && (
          <span className="ml-2 badge badge-warning badge-sm">
            {outputs.length} outputs
          </span>
        )}
      </div>

      {/* Grid Display Area */}
      <div className="flex divide-x-4 divide-gray-300">
        {/* INPUT Section */}
        <div className="p-3 bg-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-blue-900 uppercase px-2 py-1 bg-blue-300 rounded">📋 Input</span>
          </div>
          <PuzzleGrid
            grid={input}
            title=""
            showEmojis={showEmojis}
            emojiSet={emojiSet}
          />
        </div>

        {/* OUTPUT Section(s) */}
        {outputs.map((output, idx) => (
          <div 
            key={idx}
            className={`p-3 ${isTest ? 'bg-green-200' : 'bg-yellow-200'}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${
                isTest ? 'text-green-900 bg-green-300' : 'text-yellow-900 bg-yellow-300'
              }`}>
                🎯 Output{hasMultipleOutputs ? ` ${idx + 1}` : ''}
              </span>
            </div>
            <PuzzleGrid
              grid={output}
              title=""
              showEmojis={showEmojis}
              emojiSet={emojiSet}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
