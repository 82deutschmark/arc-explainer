/**
 * useModelConfiguration.ts
 * 
 * Consolidated custom hook for model selection and configuration management.
 * Centralizes model-related state including selection, capabilities, and settings.
 * Provides a unified interface for model configuration across the application.
 * 
 * @author Claude Code (Phase 4 refactor)
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ModelConfig } from '@shared/types';

// Extended model configuration with UI state
export interface ExtendedModelConfig extends ModelConfig {
  isSelected?: boolean;
  lastUsed?: Date;
  preferredSettings?: {
    temperature?: number;
    topP?: number;
    reasoningEffort?: string;
    reasoningVerbosity?: string;
  };
}

export interface ModelSelectionState {
  selectedModels: Set<string>;
  primaryModel: string | null;
  modelSettings: Record<string, any>;
  filterCriteria: {
    provider?: string;
    isPremium?: boolean;
    isReasoning?: boolean;
    minContextWindow?: number;
    maxCostPerToken?: number;
  };
}

const fetchModels = async (): Promise<ModelConfig[]> => {
  const response = await fetch('/api/models');
  if (!response.ok) {
    throw new Error('Failed to fetch models');
  }
  return await response.json();
};

export function useModelConfiguration() {
  // Fetch models from API
  const {
    data: rawModels = [],
    isLoading: modelsLoading,
    error: modelsError,
    refetch: refetchModels
  } = useQuery<ModelConfig[], Error>({
    queryKey: ['models'],
    queryFn: fetchModels,
    staleTime: Infinity // Model configuration is static
  });

  // Model selection and configuration state
  const [state, setState] = useState<ModelSelectionState>({
    selectedModels: new Set(),
    primaryModel: null,
    modelSettings: {},
    filterCriteria: {}
  });

  // Update state helper
  const updateState = useCallback((updates: Partial<ModelSelectionState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Model selection methods
  const selectModel = useCallback((modelKey: string) => {
    const newSelected = new Set(state.selectedModels);
    newSelected.add(modelKey);
    
    updateState({ 
      selectedModels: newSelected,
      // Set as primary if no primary model selected
      primaryModel: state.primaryModel || modelKey
    });
  }, [state.selectedModels, state.primaryModel, updateState]);

  const deselectModel = useCallback((modelKey: string) => {
    const newSelected = new Set(state.selectedModels);
    newSelected.delete(modelKey);
    
    updateState({ 
      selectedModels: newSelected,
      // Clear primary if it was the deselected model
      primaryModel: state.primaryModel === modelKey ? null : state.primaryModel
    });
  }, [state.selectedModels, state.primaryModel, updateState]);

  const toggleModelSelection = useCallback((modelKey: string) => {
    if (state.selectedModels.has(modelKey)) {
      deselectModel(modelKey);
    } else {
      selectModel(modelKey);
    }
  }, [state.selectedModels, selectModel, deselectModel]);

  const setPrimaryModel = useCallback((modelKey: string | null) => {
    updateState({ primaryModel: modelKey });
    
    // Ensure primary model is also selected
    if (modelKey && !state.selectedModels.has(modelKey)) {
      selectModel(modelKey);
    }
  }, [updateState, state.selectedModels, selectModel]);

  const clearSelection = useCallback(() => {
    updateState({
      selectedModels: new Set(),
      primaryModel: null
    });
  }, [updateState]);

  // Model settings management
  const updateModelSettings = useCallback((modelKey: string, settings: any) => {
    updateState({
      modelSettings: {
        ...state.modelSettings,
        [modelKey]: {
          ...state.modelSettings[modelKey],
          ...settings
        }
      }
    });
  }, [state.modelSettings, updateState]);

  const getModelSettings = useCallback((modelKey: string) => {
    return state.modelSettings[modelKey] || {};
  }, [state.modelSettings]);

  // Filtering methods
  const updateFilterCriteria = useCallback((criteria: Partial<ModelSelectionState['filterCriteria']>) => {
    updateState({
      filterCriteria: {
        ...state.filterCriteria,
        ...criteria
      }
    });
  }, [state.filterCriteria, updateState]);

  const clearFilters = useCallback(() => {
    updateState({ filterCriteria: {} });
  }, [updateState]);

  // Model information helpers
  const getModelInfo = useCallback((modelKey: string): ModelConfig | undefined => {
    return rawModels.find(model => model.key === modelKey);
  }, [rawModels]);

  const isModelSelected = useCallback((modelKey: string): boolean => {
    return state.selectedModels.has(modelKey);
  }, [state.selectedModels]);

  const isPrimaryModel = useCallback((modelKey: string): boolean => {
    return state.primaryModel === modelKey;
  }, [state.primaryModel]);

  // Model capability checks
  const supportsTemperature = useCallback((modelKey: string): boolean => {
    const model = getModelInfo(modelKey);
    return model?.supportsTemperature ?? true;
  }, [getModelInfo]);

  const isReasoningModel = useCallback((modelKey: string): boolean => {
    const model = getModelInfo(modelKey);
    return model?.isReasoning ?? false;
  }, [getModelInfo]);

  const isGPT5ReasoningModel = useCallback((modelKey: string): boolean => {
    return ["gpt-5-2025-08-07", "gpt-5-mini-2025-08-07", "gpt-5-nano-2025-08-07"].includes(modelKey);
  }, []);

  const supportsBatchProcessing = useCallback((modelKey: string): boolean => {
    // Most models support batch processing, but some may have limitations
    const model = getModelInfo(modelKey);
    return !model?.premium; // Premium models typically don't support batch
  }, [getModelInfo]);

  // Filtered and processed models
  const filteredModels = useMemo(() => {
    let filtered = rawModels;

    if (state.filterCriteria.provider) {
      filtered = filtered.filter(model => model.provider === state.filterCriteria.provider);
    }

    if (typeof state.filterCriteria.isPremium === 'boolean') {
      filtered = filtered.filter(model => model.premium === state.filterCriteria.isPremium);
    }

    if (typeof state.filterCriteria.isReasoning === 'boolean') {
      filtered = filtered.filter(model => model.isReasoning === state.filterCriteria.isReasoning);
    }

    if (state.filterCriteria.minContextWindow) {
      filtered = filtered.filter(model => 
        (model.contextWindow ?? 0) >= (state.filterCriteria.minContextWindow || 0)
      );
    }

    if (state.filterCriteria.maxCostPerToken) {
      filtered = filtered.filter(model => 
        (Number(model.cost?.input) || 0) <= (state.filterCriteria.maxCostPerToken || Infinity)
      );
    }

    return filtered;
  }, [rawModels, state.filterCriteria]);

  // Extended models with selection state
  const extendedModels = useMemo(() => {
    return filteredModels.map(model => ({
      ...model,
      isSelected: isModelSelected(model.key),
      lastUsed: state.modelSettings[model.key]?.lastUsed,
      preferredSettings: state.modelSettings[model.key]
    }));
  }, [filteredModels, isModelSelected, state.modelSettings]);

  // Selected models information
  const selectedModelsList = useMemo(() => {
    return Array.from(state.selectedModels)
      .map(key => getModelInfo(key))
      .filter(Boolean) as ModelConfig[];
  }, [state.selectedModels, getModelInfo]);

  const primaryModelInfo = useMemo(() => {
    return state.primaryModel ? getModelInfo(state.primaryModel) : null;
  }, [state.primaryModel, getModelInfo]);

  // Provider grouping
  const modelsByProvider = useMemo(() => {
    const grouped: Record<string, ModelConfig[]> = {};
    
    filteredModels.forEach(model => {
      if (!grouped[model.provider]) {
        grouped[model.provider] = [];
      }
      grouped[model.provider].push(model);
    });

    return grouped;
  }, [filteredModels]);

  // Available providers list
  const availableProviders = useMemo(() => {
    return Array.from(new Set(rawModels.map(model => model.provider)));
  }, [rawModels]);

  return {
    // Model data
    models: extendedModels,
    rawModels,
    filteredModels,
    modelsByProvider,
    availableProviders,
    
    // Loading states
    modelsLoading,
    modelsError,
    refetchModels,
    
    // Selection state
    selectedModels: Array.from(state.selectedModels),
    selectedModelsList,
    primaryModel: state.primaryModel,
    primaryModelInfo,
    
    // Filter state
    filterCriteria: state.filterCriteria,
    
    // Selection methods
    selectModel,
    deselectModel,
    toggleModelSelection,
    setPrimaryModel,
    clearSelection,
    
    // Settings management
    updateModelSettings,
    getModelSettings,
    
    // Filtering methods
    updateFilterCriteria,
    clearFilters,
    
    // Information methods
    getModelInfo,
    isModelSelected,
    isPrimaryModel,
    
    // Capability checks
    supportsTemperature,
    isReasoningModel,
    isGPT5ReasoningModel,
    supportsBatchProcessing,
    
    // Computed stats
    totalModels: rawModels.length,
    filteredCount: filteredModels.length,
    selectedCount: state.selectedModels.size,
    hasSelection: state.selectedModels.size > 0,
    hasPrimaryModel: !!state.primaryModel,
    hasFilters: Object.keys(state.filterCriteria).length > 0
  };
}