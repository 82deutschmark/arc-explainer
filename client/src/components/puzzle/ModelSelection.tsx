/**
 * ModelSelection.tsx
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-22
 * PURPOSE: Renders organized model selection with provider grouping and filters.
 *          Updated to use hierarchical provider/family structure for better organization.
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
 * Displays organized model selection with provider grouping, filters, and collapsible sections
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
    filters,
    setFilters,
    groupedModels,
    hasActiveFilters
  } = useModelGrouping(models);

  if (!models) {
    return null;
  }

  return (
    <div>
      {/* Controls: Filters and Expand/Collapse */}
      <ModelSelectionControls
        filters={filters}
        onFilterChange={setFilters}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Provider Groups */}
      <div className="space-y-3">
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
      {groupedModels.length === 0 && hasActiveFilters && (
        <div className="text-center py-8 text-base-content/60">
          <p className="text-sm">No models match the selected filters.</p>
          <button
            onClick={() => setFilters({ premium: false, reasoning: false, fast: false })}
            className="btn btn-sm btn-ghost mt-2"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
