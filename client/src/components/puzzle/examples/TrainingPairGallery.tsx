/**
 * TrainingPairGallery.tsx
 * 
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-12T21:22:00Z
 * PURPOSE: Responsive CSS Grid gallery of training examples.
 * Auto-fits 3-6 cards per row based on viewport width.
 * Manages zoom modal state for individual cards.
 * SRP: Single responsibility = layout and orchestrate training pair cards
 * DRY: Delegates rendering to TrainingPairCard, no duplication
 * shadcn/ui: Pass - Converted to DaisyUI badge
 */

import React, { useState } from 'react';
import { TrainingPairCard } from './TrainingPairCard';
import { TrainingPairZoomModal } from './TrainingPairZoomModal';
import type { EmojiSet } from '@/lib/spaceEmojis';

interface TrainingPairGalleryProps {
  trainExamples: Array<{ input: number[][]; output: number[][] }>;
  showEmojis: boolean;
  emojiSet?: EmojiSet;
  showHeader?: boolean; // Optional header with title and count badge
}

/**
 * Gallery layout for training examples using CSS Grid.
 * Responsive auto-fit: shows 3-6 cards per row depending on viewport.
 * Click any card to open zoom modal.
 */
export function TrainingPairGallery({
  trainExamples,
  showEmojis,
  emojiSet,
  showHeader = true
}: TrainingPairGalleryProps) {
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);

  return (
    <div>
      {showHeader && (
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-base font-semibold">Training Examples</h3>
          <div className="badge badge-outline text-xs">
            {trainExamples.length} {trainExamples.length === 1 ? 'example' : 'examples'}
          </div>
        </div>
      )}

      {/* Responsive grid: auto-fit cards, min 200px, max 1fr */}
      <div className="grid gap-3" style={{
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))'
      }}>
        {trainExamples.map((example, index) => (
          <TrainingPairCard
            key={index}
            input={example.input}
            output={example.output}
            index={index}
            showEmojis={showEmojis}
            emojiSet={emojiSet}
            onZoom={() => setZoomedIndex(index)}
          />
        ))}
      </div>

      {/* Zoom modal */}
      {zoomedIndex !== null && (
        <TrainingPairZoomModal
          isOpen={true}
          onClose={() => setZoomedIndex(null)}
          input={trainExamples[zoomedIndex].input}
          output={trainExamples[zoomedIndex].output}
          index={zoomedIndex}
          showEmojis={showEmojis}
          emojiSet={emojiSet}
        />
      )}
    </div>
  );
}
