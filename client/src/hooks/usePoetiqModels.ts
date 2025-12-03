/**
 * Author: Codex (GPT-5)
 * Date: 2025-11-26
 * PURPOSE: Fetch Poetiq-specific model options (with LiteLLM-ready ids) from the backend.
 *          Used by Poetiq control surfaces to ensure OpenRouter/Gemini ids stay in sync.
 * SRP/DRY check: Pass — tiny hook dedicated to one API call, reuses react-query cache layer.
 */

import { useQuery } from '@tanstack/react-query';

export interface PoetiqModelOption {
  id: string;
  name: string;
  provider: string;
  recommended: boolean;
  routing?: string;
  requiresBYO?: boolean;
}

async function fetchPoetiqModels(): Promise<PoetiqModelOption[]> {
  const response = await fetch('/api/poetiq/models');
  if (!response.ok) {
    throw new Error('Failed to load Poetiq models');
  }

  const payload = await response.json();
  const models = payload?.data?.models;

  if (!payload?.success || !Array.isArray(models)) {
    throw new Error('Malformed Poetiq models response');
  }

  return models;
}

export function usePoetiqModels() {
  return useQuery<PoetiqModelOption[], Error>({
    queryKey: ['poetiq-models'],
    queryFn: fetchPoetiqModels,
    staleTime: 60 * 60 * 1000, // Poetiq model list rarely changes
  });
}
