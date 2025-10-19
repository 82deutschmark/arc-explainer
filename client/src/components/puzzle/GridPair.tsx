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
      className={`inline-block border-2 rounded-lg overflow-visible shadow-sm ${
        isTest ? 'border-emerald-300 bg-base-100' : 'border-slate-300 bg-base-100'
      }`}
      style={{ minWidth: 'fit-content' }}
    >
      {/* Title Bar */}
      <div className={`px-3 py-2 text-sm font-bold ${
        isTest ? 'bg-emerald-600 text-white' : 'bg-slate-600 text-white'
      }`}>
        {title}
        {hasMultipleOutputs && (
          <span className="ml-2 badge badge-warning badge-sm">
            {outputs.length} outputs
          </span>
        )}
      </div>

      {/* Grid Display Area */}
      <div className="flex divide-x-2 divide-gray-200">
        {/* INPUT Section */}
        <div className="p-3 bg-slate-50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-slate-700 uppercase px-2 py-1 bg-slate-200 rounded">📋 Input</span>
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
            className={`p-3 ${isTest ? 'bg-emerald-50' : 'bg-amber-50'}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${
                isTest ? 'text-emerald-700 bg-emerald-100' : 'text-amber-700 bg-amber-100'
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
