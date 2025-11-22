/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-22
 * PURPOSE: Hook for managing model grouping state, filters, and localStorage persistence.
 *          Handles expand/collapse state for provider groups and filtering logic.
 * SRP/DRY check: Pass - Single responsibility: model grouping state management.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ModelConfig } from '@shared/types';
import { PROVIDER_GROUPS, type ProviderGroup } from '@shared/modelGroups';

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

  // Group filtered models by provider
  const groupedModels = useMemo(() => {
    const filteredModelKeys = new Set(filteredModels.map(m => m.key));

    return PROVIDER_GROUPS.map(provider => {
      const providerModels = filteredModels.filter(model => {
        // Check if model is in any of this provider's families
        return provider.families.some(family =>
          family.modelKeys.includes(model.key)
        );
      });

      const families = provider.families
        .map(family => {
          const familyModels = providerModels.filter(model =>
            family.modelKeys.includes(model.key)
          );
          return {
            ...family,
            models: familyModels
          };
        })
        .filter(family => family.models.length > 0); // Only show families with models

      return {
        ...provider,
        families,
        modelCount: providerModels.length,
        totalModelCount: provider.families.reduce(
          (sum, family) => sum + family.modelKeys.length,
          0
        )
      };
    }).filter(provider => provider.modelCount > 0); // Only show providers with models
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
