/**
 * Author: Cascade Sonnet 4.5
 * Date: 2025-11-01
 * PURPOSE: React hook to fetch saved Saturn explanation from database after streaming completes.
 * Ensures Saturn results display in standard AnalysisResultCard with correctness indicators.
 * SRP/DRY check: Pass - Single responsibility (fetch explanation after Saturn completion)
 */

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import type { ExplanationData } from '@/types/puzzle';

export function useSaturnExplanation(
  taskId: string | undefined,
  modelKey: string | undefined,
  shouldFetch: boolean  // Only fetch when streaming completes
) {
  const [explanation, setExplanation] = useState<ExplanationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    if (!taskId || !modelKey || !shouldFetch) {
      return;
    }
    
    const fetchExplanation = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        console.log(`[SaturnExplanation] Fetching saved explanation for ${taskId} / ${modelKey}`);
        
        // Fetch all explanations for this puzzle
        const res = await apiRequest('GET', `/api/puzzle/${taskId}/explanations`);
        const data = await res.json();
        
        if (!data.success || !Array.isArray(data.data)) {
          throw new Error('Failed to fetch explanations');
        }
        
        // Find the explanation for this model (most recent if multiple)
        const explanations = data.data as ExplanationData[];
        const matchingExplanation = explanations
          .filter((exp: ExplanationData) => exp.modelName === modelKey)
          .sort((a: ExplanationData, b: ExplanationData) => {
            // Sort by createdAt descending (most recent first)
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return dateB - dateA;
          })[0];
        
        if (matchingExplanation) {
          console.log(`[SaturnExplanation] Found explanation ID ${matchingExplanation.id}`);
          setExplanation(matchingExplanation);
        } else {
          console.warn(`[SaturnExplanation] No explanation found for model ${modelKey}`);
          setError(new Error('Explanation not found in database'));
        }
      } catch (err) {
        console.error('[SaturnExplanation] Failed to fetch explanation:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    };
    
    // Small delay to ensure database write completes
    // Backend saves to DB in saturnStreamService.ts before sending stream.complete event
    const timer = setTimeout(fetchExplanation, 300);
    return () => clearTimeout(timer);
  }, [taskId, modelKey, shouldFetch]);
  
  return { explanation, isLoading, error };
}
