/**
 * Author: Claude Opus 5.5
 * Date: 14-Nov-2026
 * PURPOSE: The one query for the Card Cabinet collection (/api/news/cards), shared by the card catalog and card pages,
 *          person profiles, team rosters and the "In this story" card strips. React Query dedupes by key, so every view
 *          reads the same cached collection. Pair with cardForPerson() from shared/newsCollection.ts to pick the card
 *          for a person in a contest's context.
 * SRP/DRY check: Pass — replaces four copy-pasted useQuery blocks; sits beside useNews() (components/news/NewsDesk.tsx).
 */
import { useQuery } from '@tanstack/react-query';
import type { NewsCollection } from '@shared/newsCollection';

export const NEWS_COLLECTION_QUERY_KEY = ['/api/news/cards'] as const;

export function useNewsCollection() {
  return useQuery<NewsCollection>({
    queryKey: NEWS_COLLECTION_QUERY_KEY, staleTime: 60_000,
    queryFn: async () => {
      const response = await fetch('/api/news/cards');
      if (!response.ok) throw new Error('The cards could not be loaded.');
      return response.json() as Promise<NewsCollection>;
    },
  });
}
