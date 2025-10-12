/**
 * useRefinementState.ts
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-07
 * PURPOSE: Custom hook for managing progressive refinement state and actions.
 * Single model refines its own analysis through multiple iterations with full conversation chaining.
 * Single responsibility: Refinement state management only.
 * SRP/DRY check: Pass - Focused only on state management for single-model refinement
 * shadcn/ui: N/A - State management hook only
 */

import { useState } from 'react';
import type { ExplanationData } from '@/types/puzzle';

interface RefinementIteration {
  id: string;
  iterationNumber: number;
  content: ExplanationData;
  timestamp: string;
}

export const useRefinementState = () => {
  // Core state
  const [originalExplanationId, setOriginalExplanationId] = useState<number | null>(null);
  const [activeModel, setActiveModel] = useState<string>(''); // Locked to original model
  const [iterations, setIterations] = useState<RefinementIteration[]>([]);
  const [userGuidance, setUserGuidance] = useState(''); // Optional user input for next iteration
  const [correctnessFilter, setCorrectnessFilter] = useState<'all' | 'correct' | 'incorrect'>('all');

  // Derived state
  const isRefinementActive = originalExplanationId !== null;
  const currentIteration = iterations.length;

  // Actions
  const startRefinement = (explanation: ExplanationData) => {
    setOriginalExplanationId(explanation.id);
    setActiveModel(explanation.modelName); // Lock to this model
    setIterations([{
      id: `original-${explanation.id}`,
      iterationNumber: 1, // Start at 1 for display
      content: explanation,
      timestamp: explanation.createdAt
    }]);
  };

  const endRefinement = () => {
    setOriginalExplanationId(null);
    setActiveModel('');
    setIterations([]);
    setUserGuidance('');
  };

  const resetRefinement = () => {
    // Keep only the original iteration
    setIterations(prev => prev.filter(iter => iter.iterationNumber === 1));
    setUserGuidance('');
  };

  const addIteration = (content: ExplanationData) => {
    setIterations(prev => [
      ...prev,
      {
        id: `iter-${prev.length}`,
        iterationNumber: prev.length + 1, // 1-indexed for display
        content,
        timestamp: new Date().toISOString()
      }
    ]);
  };

  // Extract provider from model key (e.g., "openai/o4-mini" -> "openai")
  const extractProvider = (modelKey: string): string => {
    if (modelKey.includes('/')) {
      return modelKey.split('/')[0].toLowerCase();
    }
    // Handle legacy model keys without provider prefix
    const normalized = modelKey.toLowerCase();
    if (normalized.includes('gpt') || normalized.includes('o1') || normalized.includes('o3') || normalized.includes('o4')) {
      return 'openai';
    }
    if (normalized.includes('grok')) {
      return 'xai';
    }
    return 'unknown';
  };

  // Get the last response ID for conversation chaining
  // Always returns from the same model (locked conversation)
  const getLastResponseId = (): string | undefined => {
    if (iterations.length === 0) return undefined;

    const lastIteration = iterations[iterations.length - 1];
    return lastIteration.content.providerResponseId || undefined;
  };

  // Get original iteration
  const getOriginalIteration = (): RefinementIteration | undefined => {
    return iterations.find(iter => iter.iterationNumber === 1);
  };

  // Get all refinement iterations (excluding original)
  const getRefinementIterations = (): RefinementIteration[] => {
    return iterations.filter(iter => iter.iterationNumber > 1);
  };

  return {
    // State
    originalExplanationId,
    activeModel, // Locked to original model, not changeable
    iterations,
    userGuidance,
    correctnessFilter,
    isRefinementActive,
    currentIteration,

    // Actions
    setOriginalExplanationId,
    setUserGuidance,
    setCorrectnessFilter,
    startRefinement,
    endRefinement,
    resetRefinement,
    addIteration,

    // Utilities
    getLastResponseId,
    extractProvider,
    getOriginalIteration,
    getRefinementIterations
  };
};
