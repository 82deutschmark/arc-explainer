/**
 * TrainingPairZoomModal.tsx
 * 
 * Author: Cascade using Sonnet 4
 * Date: 2025-10-11T19:20:00Z
 * PURPOSE: Full-screen modal for examining a training pair in detail.
 * Displays larger grids with full dimensions visible.
 * SRP: Single responsibility = modal zoom view for one training example
 * DRY: Reuses PuzzleGrid and shadcn Dialog
 * shadcn/ui: Uses Dialog component
 */

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Training Example {index + 1} - Detailed View</DialogTitle>
        </DialogHeader>
        
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
      </DialogContent>
    </Dialog>
  );
}
