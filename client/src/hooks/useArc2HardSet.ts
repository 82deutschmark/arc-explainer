/**
 * Author: Claude Fable 5.1 High
 * Date: 19-October-2026
 * PURPOSE: React Query hook for GET /api/arc2/hard-set, the ARC-AGI-2 public-eval puzzles that at most
 *          two logged attempts have solved. Returns the puzzle rows already grouped into the shared
 *          never / once / twice buckets so the page only renders.
 * SRP/DRY check: Pass — uses the app's default query fetcher (URL as query key) like usePuzzle, and the
 *                bucket order from shared/arc2HardSet.ts; no component logic here.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Arc2HardSetBucket } from '@shared/arc2HardSet';

export interface Arc2HardSetSolver {
  explanationId: number;
  modelName: string;
  createdAt: string | null;
}

export interface Arc2HardSetPuzzle {
  puzzleId: string;
  bucket: Arc2HardSetBucket;
  testCaseCount: number;
  attempts: number;
  solved: number;
  modelsAttempted: number;
  latestAttempt: string | null;
  solvers: Arc2HardSetSolver[];
}

interface Arc2HardSetPayload {
  puzzles: Arc2HardSetPuzzle[];
  total: number;
  maxSolves: number;
  generatedAt: string;
}

interface APIResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export const ARC2_HARD_SET_BUCKET_ORDER: Arc2HardSetBucket[] = ['never', 'once', 'twice'];

export function useArc2HardSet() {
  const query = useQuery<APIResponse<Arc2HardSetPayload>>({
    queryKey: ['/api/arc2/hard-set'],
    staleTime: 10 * 60 * 1000, // membership only moves when new results are ingested
  });

  const payload = query.data?.success ? query.data.data : undefined;

  const byBucket = useMemo(() => {
    const groups: Record<Arc2HardSetBucket, Arc2HardSetPuzzle[]> = { never: [], once: [], twice: [] };
    for (const puzzle of payload?.puzzles ?? []) groups[puzzle.bucket].push(puzzle);
    return groups;
  }, [payload]);

  return {
    puzzles: payload?.puzzles ?? [],
    byBucket,
    generatedAt: payload?.generatedAt ?? null,
    isLoading: query.isLoading,
    error: query.error ?? (query.data && !query.data.success ? new Error(query.data.message ?? 'Request failed') : null),
  };
}
