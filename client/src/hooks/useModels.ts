/**
 * useModels.ts
 * 
 * Custom hook to fetch and manage the list of available AI models from the server.
 * This hook uses react-query to handle data fetching, caching, and state management,
 * ensuring the client always has an up-to-date list of models from the single source of truth.
 * 
 * @author Cascade
 */

import { useQuery } from '@tanstack/react-query';
import { ModelConfig } from '@shared/types';

const fetchModels = async (): Promise<ModelConfig[]> => {
  const response = await fetch('/api/models');
  if (!response.ok) {
    throw new Error('Failed to fetch models');
  }
  const data = await response.json();
  return data;
};

export const useModels = () => {
  return useQuery<ModelConfig[], Error>({
    queryKey: ['models'],
    queryFn: fetchModels,
    staleTime: 60 * 60 * 1000 // Cache for 1 hour - models config rarely changes
  });
};
