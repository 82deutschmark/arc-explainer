/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-22
 * PURPOSE: Renders a model family sub-group with labeled divider and grid of model cards.
 *          Displays models from a single family (e.g., "GPT-5 Series") within a provider section.
 * SRP/DRY check: Pass - Single responsibility: family sub-group rendering.
 */

import React from 'react';
import { ModelButton } from './ModelButton';
import type { ExplanationData } from '@/types/puzzle';
import type { ModelConfig } from '@shared/types';

interface ModelFamilyGroupProps {
  family: {
    id: string;
    name: string;
    description?: string;
    models: ModelConfig[];
  };
  processingModels: Set<string>;
  streamingModelKey: string | null;
  streamingEnabled: boolean;
  canStreamModel: (modelKey: string) => boolean;
  explanations: ExplanationData[];
  onAnalyze: (modelKey: string) => void;
  analyzerErrors: Map<string, Error>;
}

export function ModelFamilyGroup({
  family,
  processingModels,
  streamingModelKey,
  streamingEnabled,
  canStreamModel,
  explanations,
  onAnalyze,
  analyzerErrors
}: ModelFamilyGroupProps) {
  const isStreamingActive = streamingModelKey !== null;

  if (family.models.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1.5">
      {/* Only show divider for families with >3 models */}
      {family.models.length > 3 ? (
        <div className="flex items-center gap-2 my-1.5">
          <div className="h-px flex-1 bg-base-300/50" />
          <div className="text-center">
            <h4 className="text-xs font-medium text-base-content/60 px-2">
              {family.name}
            </h4>
            {family.description && (
              <p className="text-xs text-base-content/40">{family.description}</p>
            )}
          </div>
          <div className="h-px flex-1 bg-base-300/50" />
        </div>
      ) : (
        // Inline label for small families
        <div className="mb-1">
          <span className="text-xs font-medium text-base-content/50 bg-base-200 px-2 py-0.5 rounded-md inline-block">
            {family.name}
          </span>
        </div>
      )}

      {/* Model Grid - preserves existing 4-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1.5">
        {family.models.map((model) => {
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
    </div>
  );
}
