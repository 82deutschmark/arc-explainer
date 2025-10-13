/**
 * TestCaseZoomModal.tsx
 * 
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-12T21:30:00Z
 * PURPOSE: Full-screen modal for examining a test case in detail.
 * Displays larger grids with full dimensions visible.
 * Similar to TrainingPairZoomModal for consistency.
 * 
 * SRP/DRY check: Pass - Single responsibility: modal zoom view for one test case
 * shadcn/ui: Pass - Converted to DaisyUI modal
 */

import React from 'react';
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import { ArrowRight } from 'lucide-react';
import type { EmojiSet } from '@/lib/spaceEmojis';

interface TestCaseZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  input: number[][];
  output: number[][];
  index: number;
  isMultiTest: boolean;
  showEmojis: boolean;
  emojiSet?: EmojiSet;
}

/**
 * Modal displaying full-size test case for detailed inspection.
 * Grids are rendered at larger scale for visibility.
 */
export function TestCaseZoomModal({
  isOpen,
  onClose,
  input,
  output,
  index,
  isMultiTest,
  showEmojis,
  emojiSet
}: TestCaseZoomModalProps) {
  const title = isMultiTest 
    ? `Test Case ${index + 1} - Detailed View`
    : 'Test Case - Detailed View';

  return (
    <dialog className={`modal ${isOpen ? 'modal-open' : ''}`}>
      <div className="modal-box max-w-5xl max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-lg mb-4">{title}</h3>
        
        <div className="flex items-center justify-center gap-8 p-4">
          <PuzzleGrid 
            grid={input}
            title="Input"
            showEmojis={showEmojis}
            emojiSet={emojiSet}
          />
          
          <ArrowRight className="h-8 w-8 text-gray-400" />
          
          <PuzzleGrid 
            grid={output}
            title="Output"
            showEmojis={showEmojis}
            emojiSet={emojiSet}
          />
        </div>
        
        <div className="modal-action">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
