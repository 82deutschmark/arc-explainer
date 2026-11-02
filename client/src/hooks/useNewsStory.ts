/**
 * Author: GPT-6 / Codex (reasoning effort not exposed); GPT-6.1 Sol / Codex
 * Date: 02-November-2026
 * PURPOSE: Resolve a permanent newspaper link from the current server, without using
 * the cached front-page list. Retry missing stories while visible so a deployment
 * can arrive without leaving readers at a dead end; distinguish network failure.
 * SRP/DRY check: Pass — reuses NewsIndex and React Query's cancellation/polling.
 */
import { useQuery } from '@tanstack/react-query';
import type { NewsIndex } from '@shared/news';

export function useNewsStory(id: string) {
  return useQuery<NewsIndex | null>({
    queryKey: ['/api/news/stories', id],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/news/stories/${encodeURIComponent(id)}`, { cache: 'no-store', signal });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Unable to load this story');
      const index: NewsIndex = await response.json();
      // A successful but incompatible response is a loading failure, not an unpublished story.
      if (!Array.isArray(index.articles) || ![...index.articles, ...(index.dispatches ?? [])].some(story => story.id === id)) {
        throw new Error('The server did not return the requested story');
      }
      return index;
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: 1,
    refetchInterval: query => query.state.data == null ? 15_000 : false,
    refetchIntervalInBackground: false,
  });
}
