/**
 * PuzzleExamplesSection.tsx
 * 
 * Author: Cascade using Sonnet 4
 * Date: 2025-10-11T19:35:00Z
 * PURPOSE: Top-level orchestrator for puzzle training & test display.
 * Wraps TrainingPairGallery and TestCaseViewer in a clean, compact section.
 * Optionally supports compact/detailed view toggle with localStorage persistence.
 * SRP: Single responsibility = orchestrate training + test sections
 * DRY: Delegates to child components, no duplication
 * shadcn/ui: Uses CollapsibleCard for collapsible section
 */

import React from 'react';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { TrainingPairGallery } from './TrainingPairGallery';
import { TestCaseViewer } from './TestCaseViewer';
import { Grid3X3 } from 'lucide-react';
import type { EmojiSet } from '@/lib/spaceEmojis';

interface PuzzleExamplesSectionProps {
  trainExamples: Array<{ input: number[][]; output: number[][] }>;
  testCases: Array<{ input: number[][]; output: number[][] }>;
  showEmojis: boolean;
  emojiSet?: EmojiSet;
  defaultOpen?: boolean;
}

/**
 * Complete puzzle examples section with training pairs and test cases.
 * Displays in a collapsible card with dense, gallery-style layout.
 */
export function PuzzleExamplesSection({
  trainExamples,
  testCases,
  showEmojis,
  emojiSet,
  defaultOpen = true
}: PuzzleExamplesSectionProps) {
  return (
    <CollapsibleCard
      title="Puzzle Pattern"
      icon={Grid3X3}
      defaultOpen={defaultOpen}
      headerDescription={
        <p className="text-sm text-gray-600">
          Training examples demonstrate the pattern; test cases show the challenge
        </p>
      }
    >
      <div className="space-y-6">
        {/* Training examples gallery */}
        <TrainingPairGallery
          trainExamples={trainExamples}
        />

        {/* Test cases viewer */}
        <TestCaseViewer
          testCases={testCases}
          showEmojis={showEmojis}
          emojiSet={emojiSet}
        />
      </div>
    </CollapsibleCard>
  );
}
