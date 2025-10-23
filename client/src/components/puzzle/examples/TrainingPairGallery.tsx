/**
 * TrainingPairGallery.tsx
 *
 * Author: gpt-5-codex
 * Date: 2025-02-14
 * PURPOSE: Responsive CSS grid that orchestrates the training pair cards.
 *          Applies the new split-card layout while handling zoom interactions.
 * SRP/DRY check: Pass — purely responsible for gallery layout and modal state.
 */

import React, { useState } from 'react';
import { TrainingPairCard } from './TrainingPairCard';
import { TrainingPairZoomModal } from './TrainingPairZoomModal';

interface TrainingPairGalleryProps {
  trainExamples: Array<{ input: number[][]; output: number[][] }>;
  showHeader?: boolean; // Optional header with title and count badge
}

export function TrainingPairGallery({
  trainExamples,
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

      {/* Responsive grid: auto-fit cards, min 320px to comfortably fit split layout */}
      <div className="grid gap-3" style={{
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))'
      }}>
        {trainExamples.map((example, index) => (
          <TrainingPairCard
            key={index}
            input={example.input}
            output={example.output}
            index={index}
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
        />
      )}
    </div>
  );
}
