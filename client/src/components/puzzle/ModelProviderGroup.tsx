/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-22
 * PURPOSE: Collapsible provider section that groups models by provider with summary header.
 *          Displays provider name, icon, model count, and contains family sub-groups.
 * SRP/DRY check: Pass - Single responsibility: provider group rendering and collapse state.
 */

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { ModelFamilyGroup } from './ModelFamilyGroup';
import { ModelButton } from './ModelButton';
import type { ExplanationData } from '@/types/puzzle';
import type { ModelConfig } from '@shared/types';

interface ModelProviderGroupProps {
  provider: {
    id: string;
    name: string;
    icon: string;
    families: Array<{
      id: string;
      name: string;
      description?: string;
      models: ModelConfig[];
    }>;
    modelCount: number;
    totalModelCount: number;
  };
  isExpanded: boolean;
  onToggle: () => void;
  processingModels: Set<string>;
  streamingModelKey: string | null;
  streamingEnabled: boolean;
  canStreamModel: (modelKey: string) => boolean;
  explanations: ExplanationData[];
  onAnalyze: (modelKey: string) => void;
  analyzerErrors: Map<string, Error>;
}

export function ModelProviderGroup({
  provider,
  isExpanded,
  onToggle,
  processingModels,
  streamingModelKey,
  streamingEnabled,
  canStreamModel,
  explanations,
  onAnalyze,
  analyzerErrors
}: ModelProviderGroupProps) {
  // Calculate how many analyses exist for this provider
  const analysisCount = explanations.filter(exp => {
    return provider.families.some(family =>
      family.models.some(model => model.key === exp.modelName)
    );
  }).length;

  // Check if any models in this provider are premium
  const hasPremium = provider.families.some(family =>
    family.models.some(model => model.premium)
  );

  return (
    <div className="mb-2">
      {/* Provider Header - Clickable to expand/collapse */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-2 bg-base-200 rounded-lg hover:bg-base-300 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{provider.icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{provider.name}</h3>
              {hasPremium && (
                <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full">
                  💰
                </span>
              )}
            </div>
            <p className="text-xs text-base-content/60">
              {provider.modelCount} model{provider.modelCount !== 1 ? 's' : ''}
              {analysisCount > 0 && ` • ${analysisCount} analysis${analysisCount !== 1 ? 'es' : ''}`}
            </p>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Provider Content - Family Groups */}
      {isExpanded && (
        <div className="mt-2 p-2 space-y-2">
          {provider.shouldFlatten ? (
            // Single family - skip divider, show models directly
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1.5">
              {provider.families[0].models.map((model) => (
                <ModelButton
                  key={model.key}
                  model={model}
                  isAnalyzing={processingModels.has(model.key)}
                  isStreaming={streamingModelKey === model.key}
                  streamingSupported={streamingEnabled && canStreamModel(model.key)}
                  explanationCount={explanations.filter(exp => exp.modelName === model.key).length}
                  onAnalyze={onAnalyze}
                  disabled={processingModels.has(model.key) || (streamingModelKey !== null && streamingModelKey !== model.key)}
                  error={analyzerErrors.get(model.key)}
                />
              ))}
            </div>
          ) : (
            // Multiple families - use intelligent grouping
            provider.families.map((family) => (
              <ModelFamilyGroup
                key={family.id}
                family={family}
                processingModels={processingModels}
                streamingModelKey={streamingModelKey}
                streamingEnabled={streamingEnabled}
                canStreamModel={canStreamModel}
                explanations={explanations}
                onAnalyze={onAnalyze}
                analyzerErrors={analyzerErrors}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
