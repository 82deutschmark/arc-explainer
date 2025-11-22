/**
 * ModelSelection.tsx
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-22
 * PURPOSE: Renders organized model selection with provider grouping.
 *          Updated to use hierarchical provider/family structure for better organization.
 *          Removed filtering for professional research platform density.
 *
 * SRP/DRY check: Pass - Single responsibility (model selection UI orchestration)
 */

import React from 'react';
import { ModelProviderGroup } from './ModelProviderGroup';
import { ModelSelectionControls } from './ModelSelectionControls';
import { useModelGrouping } from '@/hooks/useModelGrouping';
import type { ExplanationData } from '@/types/puzzle';
import type { ModelConfig } from '@shared/types';

interface ModelSelectionProps {
  models: ModelConfig[] | undefined;
  processingModels: Set<string>;
  streamingModelKey: string | null;
  streamingEnabled: boolean;
  canStreamModel: (modelKey: string) => boolean;
  explanations: ExplanationData[];
  onAnalyze: (modelKey: string) => void;
  analyzerErrors: Map<string, Error>;
}

/**
 * Displays organized model selection with provider grouping and collapsible sections
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
  const {
    expandedProviders,
    toggleProvider,
    expandAll,
    collapseAll,
    groupedModels
  } = useModelGrouping(models);

  if (!models) {
    return null;
  }

  return (
    <div>
      {/* Controls: Expand/Collapse Only */}
      <ModelSelectionControls
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
      />

      {/* Provider Groups */}
      <div className="space-y-2">
        {groupedModels.map((provider) => (
          <ModelProviderGroup
            key={provider.id}
            provider={provider}
            isExpanded={expandedProviders.has(provider.id)}
            onToggle={() => toggleProvider(provider.id)}
            processingModels={processingModels}
            streamingModelKey={streamingModelKey}
            streamingEnabled={streamingEnabled}
            canStreamModel={canStreamModel}
            explanations={explanations}
            onAnalyze={onAnalyze}
            analyzerErrors={analyzerErrors}
          />
        ))}
      </div>

      {/* Empty State */}
      {groupedModels.length === 0 && (
        <div className="text-center py-8 text-base-content/60">
          <p className="text-sm">No models available.</p>
        </div>
      )}
    </div>
  );
}
