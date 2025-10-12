/**
 * ModelSelection.tsx
 *
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-12
 * PURPOSE: Renders the grid of model buttons for analysis selection.
 * Extracted from PuzzleExaminer lines 859-889 to follow SRP.
 * 
 * SRP/DRY check: Pass - Single responsibility (model selection UI)
 * DaisyUI: Pass - Uses DaisyUI grid system
 */

import React from 'react';
import { ModelButton } from './ModelButton';
import type { ModelConfig, AnalysisResult } from '@/types/puzzle';

interface ModelSelectionProps {
  models: ModelConfig[] | undefined;
  processingModels: Set<string>;
  streamingModelKey: string | null;
  streamingEnabled: boolean;
  canStreamModel: (modelKey: string) => boolean;
  explanations: AnalysisResult[];
  onAnalyze: (modelKey: string) => void;
  analyzerErrors: Map<string, Error>;
}

/**
 * Displays a responsive grid of model selection buttons
 */
export function ModelSelection({
  models,
  processingModels,
  streamingModelKey,
  streamingEnabled,
  canStreamModel,
  explanations,
  onAnalyze,
  analyzerErrors
}: ModelSelectionProps) {
  const isStreamingActive = streamingModelKey !== null;

  if (!models) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
      {models.map((model) => {
        const isProcessing = processingModels.has(model.key);
        const isStreamingThisModel = streamingModelKey === model.key;
        const disableDueToStreaming = isStreamingActive && !isStreamingThisModel;

        return (
          <ModelButton
            key={model.key}
            model={model}
            isAnalyzing={isProcessing}
            isStreaming={isStreamingThisModel}
            streamingSupported={streamingEnabled && canStreamModel(model.key)}
            explanationCount={explanations.filter(explanation => explanation.modelName === model.key).length}
            onAnalyze={onAnalyze}
            disabled={isProcessing || disableDueToStreaming}
            error={analyzerErrors.get(model.key)}
          />
        );
      })}
    </div>
  );
}
