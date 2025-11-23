/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-22
 * PURPOSE: Hook for managing model grouping state, filters, and localStorage persistence.
 *          Handles expand/collapse state for provider groups and filtering logic.
 * SRP/DRY check: Pass - Single responsibility: model grouping state management.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ModelConfig } from '@shared/types';
import { PROVIDER_GROUPS } from '@shared/modelGroups';

interface FilterState {
  premium: boolean;
  reasoning: boolean;
  fast: boolean;
}

const DEFAULT_EXPANDED = ['openai', 'anthropic', 'gemini'];
const STORAGE_KEY = 'puzzleExaminer.modelSelection.state';

export function useModelGrouping(models: ModelConfig[] | undefined) {
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(
    () => new Set(DEFAULT_EXPANDED)
  );

  const [filters, setFilters] = useState<FilterState>({
    premium: false,
    reasoning: false,
    fast: false
  });

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const state = JSON.parse(saved);
        if (state.expanded && Array.isArray(state.expanded)) {
          setExpandedProviders(new Set(state.expanded));
        }
        if (state.filters) {
          setFilters(state.filters);
        }
      }
    } catch (error) {
      console.error('Failed to load model grouping state:', error);
    }
  }, []);

  // Save to localStorage when state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        expanded: Array.from(expandedProviders),
        filters
      }));
    } catch (error) {
      console.error('Failed to save model grouping state:', error);
    }
  }, [expandedProviders, filters]);

  const toggleProvider = useCallback((providerId: string) => {
    setExpandedProviders(prev => {
      const next = new Set(prev);
      if (next.has(providerId)) {
        next.delete(providerId);
      } else {
        next.add(providerId);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedProviders(new Set(PROVIDER_GROUPS.map(p => p.id)));
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedProviders(new Set());
  }, []);

  // Filter models based on active filters
  const filteredModels = useMemo(() => {
    if (!models) return [];

    let filtered = [...models];

    if (filters.premium) {
      filtered = filtered.filter(m => m.premium);
    }

    if (filters.reasoning) {
      filtered = filtered.filter(m => m.isReasoning);
    }

    if (filters.fast) {
      filtered = filtered.filter(m =>
        m.responseTime?.speed === 'fast' ||
        m.responseTime?.estimate?.includes('<30 sec')
      );
    }

    return filtered;
  }, [models, filters]);

  // Helper: Determine if family needs full divider or inline label
  const shouldUseInlineLabel = (family: { models: ModelConfig[] }): boolean => {
    return family.models.length <= 3;
  };

  // Helper: Determine if provider should skip family grouping
  const shouldFlattenFamilies = (families: any[]): boolean => {
    return families.length === 1;
  };

  // Group filtered models by provider
  const groupedModels = useMemo(() => {
    if (!filteredModels.length) {
      return [];
    }

    const providerIdByName: Record<ModelConfig['provider'], string> = {
      OpenAI: 'openai',
      Anthropic: 'anthropic',
      xAI: 'xai',
      Gemini: 'gemini',
      DeepSeek: 'deepseek',
      OpenRouter: 'openrouter',
      Grover: 'grover',
      Saturn: 'saturn'
    };

    const assignedKeys = new Set<string>();
    const result: any[] = [];

    // First, build groups for statically configured providers using PROVIDER_GROUPS
    PROVIDER_GROUPS.forEach(provider => {
      const providerNames = Object.entries(providerIdByName)
        .filter(([, id]) => id === provider.id)
        .map(([name]) => name);

      const providerModels = filteredModels.filter(model =>
        providerNames.includes(model.provider)
      );

      if (providerModels.length === 0) {
        return;
      }

      const familiesWithModels = provider.families.map(family => {
        const familyModels = providerModels.filter(model => family.modelKeys.includes(model.key));
        familyModels.forEach(model => assignedKeys.add(model.key));
        return {
          ...family,
          models: familyModels
        };
      });

      let families = familiesWithModels.filter(family => family.models.length > 0);

      const ungroupedModels = providerModels.filter(model => !assignedKeys.has(model.key));

      if (ungroupedModels.length > 0) {
        ungroupedModels.forEach(model => assignedKeys.add(model.key));

        const existingOtherIndex = families.findIndex(family =>
          family.id === 'or-other' ||
          family.id === `${provider.id}-other` ||
          family.name.toLowerCase().includes('other')
        );

        if (existingOtherIndex >= 0) {
          const existingFamily = families[existingOtherIndex];
          families[existingOtherIndex] = {
            ...existingFamily,
            models: [...existingFamily.models, ...ungroupedModels]
          };
        } else {
          families.push({
            id: `${provider.id}-other`,
            name: 'Other models',
            description: families.length > 0 ? 'Additional models from this provider' : undefined,
            modelKeys: [],
            models: ungroupedModels
          });
        }
      }

      result.push({
        ...provider,
        families: families.map(f => ({
          ...f,
          useInlineLabel: shouldUseInlineLabel(f)
        })),
        shouldFlatten: shouldFlattenFamilies(families),
        modelCount: providerModels.length,
        totalModelCount: providerModels.length
      });
    });

    // Then, create synthetic provider groups for any remaining models so they stay visible
    const remainingModels = filteredModels.filter(model => !assignedKeys.has(model.key));

    if (remainingModels.length > 0) {
      const modelsByProvider: Record<string, ModelConfig[]> = remainingModels.reduce(
        (acc, model) => {
          if (!acc[model.provider]) {
            acc[model.provider] = [];
          }
          acc[model.provider].push(model);
          return acc;
        },
        {} as Record<string, ModelConfig[]>
      );

      Object.entries(modelsByProvider).forEach(([providerName, modelsForProvider]) => {
        const id = providerName.toLowerCase().replace(/\s+/g, '-');

        const syntheticFamilies = [
          {
            id: `${id}-all`,
            name: 'All models',
            description: undefined,
            modelKeys: [],
            models: modelsForProvider,
            useInlineLabel: shouldUseInlineLabel({ models: modelsForProvider })
          }
        ];

        result.push({
          id,
          name: providerName,
          icon: '🧪',
          defaultOpen: false,
          families: syntheticFamilies,
          shouldFlatten: shouldFlattenFamilies(syntheticFamilies),
          modelCount: modelsForProvider.length,
          totalModelCount: modelsForProvider.length
        });
      });
    }

    return result;
  }, [filteredModels]);

  return {
    expandedProviders,
    toggleProvider,
    expandAll,
    collapseAll,
    filters,
    setFilters,
    filteredModels,
    groupedModels,
    hasActiveFilters: filters.premium || filters.reasoning || filters.fast
  };
}
