/**
 * TrainingPairZoomModal.tsx
 * 
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-12T21:28:00Z
 * PURPOSE: Full-screen modal for examining a training pair in detail.
 * Displays larger grids with full dimensions visible.
 * SRP: Single responsibility = modal zoom view for one training example
 * DRY: Reuses PuzzleGrid component
 * shadcn/ui: Pass - Converted to DaisyUI modal
 */

import React from 'react';
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import { ArrowRight } from 'lucide-react';
import type { EmojiSet } from '@/lib/spaceEmojis';

interface TrainingPairZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  input: number[][];
  output: number[][];
  index: number;
  showEmojis: boolean;
  emojiSet?: EmojiSet;
}

/**
 * Modal displaying full-size training pair for detailed inspection.
 * Grids are rendered at larger scale for visibility.
 */
export function TrainingPairZoomModal({
  isOpen,
  onClose,
  input,
  output,
  index,
  showEmojis,
  emojiSet
}: TrainingPairZoomModalProps) {
  return (
    <dialog className={`modal ${isOpen ? 'modal-open' : ''}`}>
      <div className="modal-box max-w-5xl max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-lg mb-4">Training Example {index + 1} - Detailed View</h3>
        
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
