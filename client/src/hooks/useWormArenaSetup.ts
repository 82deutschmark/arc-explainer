/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-12-15
 * PURPOSE: Custom hook for Worm Arena setup state management.
 *          Encapsulates model selection, board settings, and BYO API key state.
 *          Reduces WormArenaLive page component complexity by consolidating
 *          19 state variables into a single hook.
 * SRP/DRY check: Pass - Single responsibility: manage setup form state.
 *                No duplication; extracts repeated patterns from page component.
 */

import { useState } from 'react';

export type ByoProvider = 'openrouter' | 'openai' | 'anthropic' | 'xai' | 'gemini';

export interface WormArenaSetupState {
  modelA: string;
  modelB: string;
  width: number;
  height: number;
  maxRounds: number;
  numApples: number;
  byoApiKey: string;
  byoProvider: ByoProvider;
}

export interface WormArenaSetupActions {
  setModelA: (model: string) => void;
  setModelB: (model: string) => void;
  setWidth: (width: number) => void;
  setHeight: (height: number) => void;
  setMaxRounds: (maxRounds: number) => void;
  setNumApples: (numApples: number) => void;
  setByoApiKey: (key: string) => void;
  setByoProvider: (provider: ByoProvider) => void;
}

export interface WormArenaSetupReturn extends WormArenaSetupState, WormArenaSetupActions {
  isValid: (availableModels: Set<string>) => boolean;
}

/**
 * Hook for managing Worm Arena setup state.
 * Provides state for model selection, board settings, and BYO API key.
 */
export function useWormArenaSetup(): WormArenaSetupReturn {
  const [modelA, setModelA] = useState<string>('');
  const [modelB, setModelB] = useState<string>('');
  const [width, setWidth] = useState<number>(10);
  const [height, setHeight] = useState<number>(10);
  const [maxRounds, setMaxRounds] = useState<number>(150);
  const [numApples, setNumApples] = useState<number>(5);
  const [byoApiKey, setByoApiKey] = useState<string>('');
  const [byoProvider, setByoProvider] = useState<ByoProvider>('openrouter');

  /**
   * Validates that both models are selected and available.
   */
  const isValid = (availableModels: Set<string>): boolean => {
    return (
      modelA.trim().length > 0 &&
      modelB.trim().length > 0 &&
      availableModels.has(modelA) &&
      availableModels.has(modelB)
    );
  };

  return {
    modelA,
    modelB,
    width,
    height,
    maxRounds,
    numApples,
    byoApiKey,
    byoProvider,
    setModelA,
    setModelB,
    setWidth,
    setHeight,
    setMaxRounds,
    setNumApples,
    setByoApiKey,
    setByoProvider,
    isValid,
  };
}
