/**
 * useDebateState.ts
 *
 * Author: Claude Code using Sonnet 4
 * Date: 2025-09-29
 * PURPOSE: Custom hook for managing debate-specific state and actions.
 * Single responsibility: Debate state management only.
 * SRP/DRY check: Pass - Focused only on state management concerns
 */

import { useState, useMemo } from 'react';
import type { ExplanationData } from '@/types/puzzle';

interface DebateMessage {
  id: string;
  modelName: string;
  messageType: 'original' | 'challenge';
  content: ExplanationData;
  timestamp: string;
}

export const useDebateState = () => {
  // Core state
  const [selectedExplanationId, setSelectedExplanationId] = useState<number | null>(null);
  const [debateMessages, setDebateMessages] = useState<DebateMessage[]>([]);
  const [challengerModel, setChallengerModel] = useState<string>('');
  const [customChallenge, setCustomChallenge] = useState('');
  const [correctnessFilter, setCorrectnessFilter] = useState<'all' | 'correct' | 'incorrect'>('incorrect');

  // Derived state
  const isDebateActive = selectedExplanationId !== null;

  // Actions
  const startDebate = (explanation: ExplanationData) => {
    setSelectedExplanationId(explanation.id);
    setDebateMessages([{
      id: `original-${explanation.id}`,
      modelName: explanation.modelName,
      messageType: 'original',
      content: explanation,
      timestamp: explanation.createdAt
    }]);
  };

  const endDebate = () => {
    setSelectedExplanationId(null);
    setDebateMessages([]);
    setChallengerModel('');
    setCustomChallenge('');
  };

  const resetDebate = () => {
    // Keep only the original message
    setDebateMessages(prev => prev.filter(msg => msg.messageType === 'original'));
    setChallengerModel('');
    setCustomChallenge('');
  };

  const addChallengeMessage = (challengeExplanation: ExplanationData) => {
    const newMessage: DebateMessage = {
      id: `challenge-${challengeExplanation.id}`,
      modelName: challengeExplanation.modelName,
      messageType: 'challenge',
      content: challengeExplanation,
      timestamp: challengeExplanation.createdAt
    };

    setDebateMessages(prev => [...prev, newMessage]);
  };

  // Extract provider from model key (e.g., "openai/o4-mini" -> "openai")
  const extractProvider = (modelKey: string): string => {
    if (modelKey.includes('/')) {
      return modelKey.split('/')[0].toLowerCase();
    }
    // Handle legacy model keys without provider prefix
    if (modelKey.toLowerCase().includes('gpt') || modelKey.toLowerCase().includes('o1') || modelKey.toLowerCase().includes('o3') || modelKey.toLowerCase().includes('o4')) {
      return 'openai';
    }
    if (modelKey.toLowerCase().includes('grok')) {
      return 'xai';
    }
    return 'unknown';
  };

  // Get the last response ID for conversation chaining (provider-aware)
  // Only returns response ID if the challenger model is from the same provider
  const getLastResponseId = (challengerModelKey?: string): string | undefined => {
    if (debateMessages.length === 0) return undefined;
    if (!challengerModelKey) return undefined;
    
    const lastMessage = debateMessages[debateMessages.length - 1];
    const lastMessageProvider = extractProvider(lastMessage.modelName);
    const challengerProvider = extractProvider(challengerModelKey);
    
    // Only return response ID if providers match (OpenAI -> OpenAI, xAI -> xAI)
    if (lastMessageProvider === challengerProvider && lastMessageProvider !== 'unknown') {
      return lastMessage.content.providerResponseId || undefined;
    }
    
    // Cross-provider conversation not supported
    return undefined;
  };

  return {
    // State
    selectedExplanationId,
    debateMessages,
    challengerModel,
    customChallenge,
    correctnessFilter,
    isDebateActive,

    // Actions
    setSelectedExplanationId,
    setDebateMessages,
    setChallengerModel,
    setCustomChallenge,
    setCorrectnessFilter,
    startDebate,
    endDebate,
    resetDebate,
    addChallengeMessage,
    getLastResponseId, // NEW: For conversation chaining (provider-aware)
    extractProvider // Utility for provider detection
  };
};