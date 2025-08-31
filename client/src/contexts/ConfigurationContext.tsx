/**
 * ConfigurationContext.tsx
 * 
 * React context provider for global configuration state management.
 * Centralizes model configuration, user preferences, and application settings.
 * Integrates with useModelConfiguration hook for model-related state.
 * 
 * @author Claude Code (Phase 4 refactor)
 */

import React, { createContext, useContext, useCallback, useEffect, ReactNode } from 'react';
import { useModelConfiguration } from '../hooks/useModelConfiguration';
import { ModelConfig } from '@shared/types';

// User preferences interface
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  defaultTemperature: number;
  defaultPromptId: string;
  preferredModels: string[];
  showAdvancedSettings: boolean;
  autoRefreshResults: boolean;
  notificationsEnabled: boolean;
  debugMode: boolean;
}

// Application settings interface
export interface ApplicationSettings {
  apiTimeout: number;
  maxConcurrentRequests: number;
  cacheEnabled: boolean;
  experimentalFeatures: boolean;
  analyticsEnabled: boolean;
}

// Global configuration state
export interface ConfigurationState {
  // Model configuration
  models: {
    available: ModelConfig[];
    selected: string[];
    primary: string | null;
    loading: boolean;
    error: Error | null;
    filters: any;
  };
  
  // User preferences
  preferences: UserPreferences;
  
  // Application settings
  settings: ApplicationSettings;
  
  // UI state
  ui: {
    sidebarCollapsed: boolean;
    activePanel: string | null;
    showHelpTooltips: boolean;
    compactMode: boolean;
  };
}

// Configuration actions interface
export interface ConfigurationActions {
  // Model actions
  selectModel: (modelKey: string) => void;
  deselectModel: (modelKey: string) => void;
  setPrimaryModel: (modelKey: string | null) => void;
  clearModelSelection: () => void;
  updateModelFilters: (filters: any) => void;
  getModelInfo: (modelKey: string) => ModelConfig | undefined;
  
  // Preference actions
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  resetPreferences: () => void;
  
  // Settings actions
  updateSettings: (updates: Partial<ApplicationSettings>) => void;
  resetSettings: () => void;
  
  // UI actions
  toggleSidebar: () => void;
  setActivePanel: (panel: string | null) => void;
  toggleHelpTooltips: () => void;
  toggleCompactMode: () => void;
  
  // Persistence actions
  saveConfiguration: () => void;
  loadConfiguration: () => void;
  exportConfiguration: () => string;
  importConfiguration: (config: string) => boolean;
}

// Combined context interface
export interface ConfigurationContextValue extends ConfigurationState, ConfigurationActions {}

// Default preferences
const defaultPreferences: UserPreferences = {
  theme: 'system',
  defaultTemperature: 0.2,
  defaultPromptId: 'solver',
  preferredModels: [],
  showAdvancedSettings: false,
  autoRefreshResults: true,
  notificationsEnabled: true,
  debugMode: false
};

// Default settings
const defaultSettings: ApplicationSettings = {
  apiTimeout: 120000, // 2 minutes
  maxConcurrentRequests: 3,
  cacheEnabled: true,
  experimentalFeatures: false,
  analyticsEnabled: true
};

// Default UI state
const defaultUiState = {
  sidebarCollapsed: false,
  activePanel: null,
  showHelpTooltips: true,
  compactMode: false
};

// Create context
const ConfigurationContext = createContext<ConfigurationContextValue | null>(null);

// Local storage keys
const STORAGE_KEYS = {
  preferences: 'arc-explainer-preferences',
  settings: 'arc-explainer-settings',
  ui: 'arc-explainer-ui-state',
  modelSelection: 'arc-explainer-model-selection'
};

// Context provider component
export function ConfigurationProvider({ children }: { children: ReactNode }) {
  const modelConfig = useModelConfiguration();

  // Load initial state from localStorage
  const [preferences, setPreferencesState] = React.useState<UserPreferences>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.preferences);
      return stored ? { ...defaultPreferences, ...JSON.parse(stored) } : defaultPreferences;
    } catch {
      return defaultPreferences;
    }
  });

  const [settings, setSettingsState] = React.useState<ApplicationSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.settings);
      return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  const [uiState, setUiState] = React.useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ui);
      return stored ? { ...defaultUiState, ...JSON.parse(stored) } : defaultUiState;
    } catch {
      return defaultUiState;
    }
  });

  // Load model selection from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.modelSelection);
      if (stored) {
        const { selected, primary } = JSON.parse(stored);
        if (Array.isArray(selected)) {
          selected.forEach(modelKey => modelConfig.selectModel(modelKey));
        }
        if (primary) {
          modelConfig.setPrimaryModel(primary);
        }
      }
    } catch (error) {
      console.warn('Failed to load model selection from localStorage:', error);
    }
  }, [modelConfig.selectModel, modelConfig.setPrimaryModel]);

  // Save to localStorage helper
  const saveToStorage = useCallback((key: string, data: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.warn(`Failed to save ${key} to localStorage:`, error);
    }
  }, []);

  // Preference actions
  const updatePreferences = useCallback((updates: Partial<UserPreferences>) => {
    const newPreferences = { ...preferences, ...updates };
    setPreferencesState(newPreferences);
    saveToStorage(STORAGE_KEYS.preferences, newPreferences);
  }, [preferences, saveToStorage]);

  const resetPreferences = useCallback(() => {
    setPreferencesState(defaultPreferences);
    saveToStorage(STORAGE_KEYS.preferences, defaultPreferences);
  }, [saveToStorage]);

  // Settings actions
  const updateSettings = useCallback((updates: Partial<ApplicationSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettingsState(newSettings);
    saveToStorage(STORAGE_KEYS.settings, newSettings);
  }, [settings, saveToStorage]);

  const resetSettings = useCallback(() => {
    setSettingsState(defaultSettings);
    saveToStorage(STORAGE_KEYS.settings, defaultSettings);
  }, [saveToStorage]);

  // UI actions
  const toggleSidebar = useCallback(() => {
    const newUiState = { ...uiState, sidebarCollapsed: !uiState.sidebarCollapsed };
    setUiState(newUiState);
    saveToStorage(STORAGE_KEYS.ui, newUiState);
  }, [uiState, saveToStorage]);

  const setActivePanel = useCallback((panel: string | null) => {
    const newUiState = { ...uiState, activePanel: panel };
    setUiState(newUiState);
    saveToStorage(STORAGE_KEYS.ui, newUiState);
  }, [uiState, saveToStorage]);

  const toggleHelpTooltips = useCallback(() => {
    const newUiState = { ...uiState, showHelpTooltips: !uiState.showHelpTooltips };
    setUiState(newUiState);
    saveToStorage(STORAGE_KEYS.ui, newUiState);
  }, [uiState, saveToStorage]);

  const toggleCompactMode = useCallback(() => {
    const newUiState = { ...uiState, compactMode: !uiState.compactMode };
    setUiState(newUiState);
    saveToStorage(STORAGE_KEYS.ui, newUiState);
  }, [uiState, saveToStorage]);

  // Enhanced model actions with persistence
  const selectModel = useCallback((modelKey: string) => {
    modelConfig.selectModel(modelKey);
    saveToStorage(STORAGE_KEYS.modelSelection, {
      selected: [...modelConfig.selectedModels, modelKey],
      primary: modelConfig.primaryModel
    });
  }, [modelConfig, saveToStorage]);

  const deselectModel = useCallback((modelKey: string) => {
    modelConfig.deselectModel(modelKey);
    saveToStorage(STORAGE_KEYS.modelSelection, {
      selected: modelConfig.selectedModels.filter(key => key !== modelKey),
      primary: modelConfig.primaryModel === modelKey ? null : modelConfig.primaryModel
    });
  }, [modelConfig, saveToStorage]);

  const setPrimaryModel = useCallback((modelKey: string | null) => {
    modelConfig.setPrimaryModel(modelKey);
    saveToStorage(STORAGE_KEYS.modelSelection, {
      selected: modelConfig.selectedModels,
      primary: modelKey
    });
  }, [modelConfig, saveToStorage]);

  const clearModelSelection = useCallback(() => {
    modelConfig.clearSelection();
    saveToStorage(STORAGE_KEYS.modelSelection, {
      selected: [],
      primary: null
    });
  }, [modelConfig, saveToStorage]);

  // Persistence actions
  const saveConfiguration = useCallback(() => {
    // Already handled by individual update functions
    console.log('Configuration saved to localStorage');
  }, []);

  const loadConfiguration = useCallback(() => {
    // Force reload from localStorage
    window.location.reload();
  }, []);

  const exportConfiguration = useCallback(() => {
    const config = {
      preferences,
      settings,
      ui: uiState,
      modelSelection: {
        selected: modelConfig.selectedModels,
        primary: modelConfig.primaryModel,
        filters: modelConfig.filterCriteria
      },
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
    
    return JSON.stringify(config, null, 2);
  }, [preferences, settings, uiState, modelConfig.selectedModels, modelConfig.primaryModel, modelConfig.filterCriteria]);

  const importConfiguration = useCallback((configString: string) => {
    try {
      const config = JSON.parse(configString);
      
      // Validate basic structure
      if (!config || typeof config !== 'object') {
        throw new Error('Invalid configuration format');
      }

      // Import preferences
      if (config.preferences) {
        updatePreferences(config.preferences);
      }

      // Import settings
      if (config.settings) {
        updateSettings(config.settings);
      }

      // Import UI state
      if (config.ui) {
        setUiState(prev => ({ ...prev, ...config.ui }));
        saveToStorage(STORAGE_KEYS.ui, { ...uiState, ...config.ui });
      }

      // Import model selection
      if (config.modelSelection) {
        const { selected, primary, filters } = config.modelSelection;
        
        if (Array.isArray(selected)) {
          modelConfig.clearSelection();
          selected.forEach(modelKey => modelConfig.selectModel(modelKey));
        }
        
        if (primary) {
          modelConfig.setPrimaryModel(primary);
        }
        
        if (filters) {
          modelConfig.updateFilterCriteria(filters);
        }
      }

      console.log('Configuration imported successfully');
      return true;
    } catch (error) {
      console.error('Failed to import configuration:', error);
      return false;
    }
  }, [updatePreferences, updateSettings, saveToStorage, uiState, modelConfig]);

  // Combined state
  const state: ConfigurationState = {
    models: {
      available: modelConfig.models,
      selected: modelConfig.selectedModels,
      primary: modelConfig.primaryModel,
      loading: modelConfig.modelsLoading,
      error: modelConfig.modelsError,
      filters: modelConfig.filterCriteria
    },
    preferences,
    settings,
    ui: uiState
  };

  // Combined actions
  const actions: ConfigurationActions = {
    // Model actions
    selectModel,
    deselectModel,
    setPrimaryModel,
    clearModelSelection,
    updateModelFilters: modelConfig.updateFilterCriteria,
    getModelInfo: modelConfig.getModelInfo,
    
    // Preference actions
    updatePreferences,
    resetPreferences,
    
    // Settings actions
    updateSettings,
    resetSettings,
    
    // UI actions
    toggleSidebar,
    setActivePanel,
    toggleHelpTooltips,
    toggleCompactMode,
    
    // Persistence actions
    saveConfiguration,
    loadConfiguration,
    exportConfiguration,
    importConfiguration
  };

  // Combined context value
  const contextValue: ConfigurationContextValue = {
    ...state,
    ...actions
  };

  return (
    <ConfigurationContext.Provider value={contextValue}>
      {children}
    </ConfigurationContext.Provider>
  );
}

// Context hook
export function useConfigurationContext(): ConfigurationContextValue {
  const context = useContext(ConfigurationContext);
  
  if (!context) {
    throw new Error('useConfigurationContext must be used within a ConfigurationProvider');
  }
  
  return context;
}

// Specialized hooks for specific parts of the context
export function useModelConfigurationContext() {
  const { models, selectModel, deselectModel, setPrimaryModel, clearModelSelection, updateModelFilters, getModelInfo } = useConfigurationContext();
  
  return {
    ...models,
    selectModel,
    deselectModel,
    setPrimaryModel,
    clearModelSelection,
    updateModelFilters,
    getModelInfo
  };
}

export function useUserPreferencesContext() {
  const { preferences, updatePreferences, resetPreferences } = useConfigurationContext();
  
  return {
    preferences,
    updatePreferences,
    resetPreferences
  };
}

export function useApplicationSettingsContext() {
  const { settings, updateSettings, resetSettings } = useConfigurationContext();
  
  return {
    settings,
    updateSettings,
    resetSettings
  };
}

export function useUIStateContext() {
  const { ui, toggleSidebar, setActivePanel, toggleHelpTooltips, toggleCompactMode } = useConfigurationContext();
  
  return {
    ...ui,
    toggleSidebar,
    setActivePanel,
    toggleHelpTooltips,
    toggleCompactMode
  };
}

// Default export for convenience
export default ConfigurationProvider;