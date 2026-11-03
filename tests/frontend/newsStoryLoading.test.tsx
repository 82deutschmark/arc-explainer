/**
 * Author: GPT-6 / Codex (reasoning effort not exposed); GPT-6.1 Sol / Codex
 * Date: 02-November-2026
 * PURPOSE: Reproduce stale archive, late publication and connection failures at a
 * permanent article URL using the actual story page and query hook.
 * SRP/DRY check: Pass — mock only network and unrelated presentation.
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import NewsArticle from '../../client/src/pages/NewsArticle';

vi.mock('wouter', async original => ({ ...await original<object>(), useParams: () => ({ articleId: 'new-story' }) }));
vi.mock('../../client/src/hooks/usePageMeta', () => ({ usePageMeta: () => {} }));
vi.mock('../../client/src/components/news/NewsPeople', () => ({ StoryPeopleCards: () => null, TeamPeople: () => null, TeamFaces: () => null }));
vi.mock('../../client/src/components/news/NewsWelcome', () => ({ NewsWelcome: () => null }));
vi.mock('../../client/src/components/news/SponsorPlacement', () => ({ SponsorPlacement: () => null, MastheadAd: () => null }));
const story = { id: 'new-story', date: '2026-11-02', edition: 'morning', competition: 'arc-3', headline: 'NVIDIA presses the siege', dek: 'The morning scores.', sections: [{ text: 'A leap to fourth.', sourceIds: ['board'] }], sources: [{ id: 'board', title: 'Board', url: 'https://example.com', accessedAt: '2026-11-02T15:00:00Z' }], stats: [], teamIds: [], generatedBy: 'gpt-6.1-sol', publishedAt: '2026-11-02T15:00:00Z', dataAsOf: '2026-11-02T15:00:00Z', baselineAt: null, coverageNote: 'Public scores.', discord: 'Update' };
const archive = { articles: [story], competitors: [], people: [], dispatches: [] };
const response = (status: number, body: unknown = {}) => ({ status, ok: status === 200, json: async () => body } as Response);
function openPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0, gcTime: 0 } } });
  // A fresh but outdated front-page cache caused the original false missing-page error.
  client.setQueryData(['/api/news'], { articles: [], competitors: [] });
  render(<QueryClientProvider client={client}><NewsArticle /></QueryClientProvider>);
  return client;
}
afterEach(() => vi.unstubAllGlobals());
it('opens a newly published edition even when the front-page cache lacks it', async () => {
  const fetcher = vi.fn().mockResolvedValue(response(200, archive)); vi.stubGlobal('fetch', fetcher);
  openPage();
  expect(await screen.findByRole('heading', { name: story.headline })).toBeVisible();
  expect(fetcher.mock.calls[0][0]).toBe('/api/news/stories/new-story');
  expect(fetcher.mock.calls[0][1].cache).toBe('no-store');
  expect(screen.queryByText('Dispatch not found')).toBeNull();
});
it('recovers a missing story when the release arrives and the reader retries', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(response(404)).mockResolvedValue(response(200, archive)); vi.stubGlobal('fetch', fetcher);
  openPage();
  expect(await screen.findByText(/We may have gotten ahead of ourselves/)).toBeVisible();
  fireEvent.click(await screen.findByRole('button', { name: 'Check again' }));
  expect(await screen.findByRole('heading', { name: story.headline })).toBeVisible();
  expect(screen.queryByText('This story isn’t here yet')).toBeNull();
});
it('keeps loading and connection failures distinct from a missing story', async () => {
  let resolve!: (value: Response) => void;
  vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockResolvedValue(response(503)));
  openPage();
  expect(screen.getByRole('status')).toHaveTextContent('Opening the newspaper');
  resolve(response(503));
  expect(await screen.findByRole('alert')).toHaveTextContent('publication status could not be checked');
  expect(screen.queryByText('This story isn’t here yet')).toBeNull();
});
it('opens a special report through the same permanent-story lookup', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(200, { ...archive, articles: [], dispatches: [{ ...story, headline: 'The NVIDIA seven' }] })));
  openPage();
  await waitFor(() => expect(screen.getByText('The NVIDIA seven')).toBeVisible());
  expect(screen.queryByText('Dispatch not found')).toBeNull();
});

it('treats an incompatible success response as a loading failure', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(200, { articles: [], dispatches: [], competitors: [] })));
  openPage();
  expect(await screen.findByRole('alert')).toHaveTextContent('publication status could not be checked');
  expect(screen.queryByText('This story isn’t here yet')).toBeNull();
});
