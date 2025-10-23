/**
 * TrainingPairZoomModal.tsx
 *
 * Author: gpt-5-codex
 * Date: 2025-02-14
 * PURPOSE: Full-screen modal for inspecting a training example with the new
 *          split grid cards. Reuses the dedicated input/output card wrappers
 *          to guarantee consistent styling and eliminate scrollbars at larger
 *          scales.
 * SRP/DRY check: Pass — focuses on modal presentation while delegating grid
 *                rendering to shared card components.
 */

import React from 'react';
import { ArrowRight } from 'lucide-react';
import { TrainingExampleInputCard } from './TrainingExampleInputCard';
import { TrainingExampleOutputCard } from './TrainingExampleOutputCard';

interface TrainingPairZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  input: number[][];
  output: number[][];
  index: number;
}

const MODAL_CARD_DIMENSION = 320;

export function TrainingPairZoomModal({
  isOpen,
  onClose,
  input,
  output,
  index
}: TrainingPairZoomModalProps) {
  return (
    <dialog className={`modal ${isOpen ? 'modal-open' : ''}`}>
      <div className="modal-box max-w-5xl">
        <h3 className="font-bold text-lg mb-4">Training Example {index + 1} — Detailed View</h3>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <TrainingExampleInputCard
            grid={input}
            className="md:flex-1"
            maxWidth={MODAL_CARD_DIMENSION}
            maxHeight={MODAL_CARD_DIMENSION}
            useIntelligentSizing
          />

          <div className="flex items-center justify-center text-gray-400">
            <ArrowRight className="h-7 w-7" />
          </div>

          <TrainingExampleOutputCard
            grid={output}
            className="md:flex-1"
            maxWidth={MODAL_CARD_DIMENSION}
            maxHeight={MODAL_CARD_DIMENSION}
            useIntelligentSizing
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
