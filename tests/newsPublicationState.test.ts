/**
 * Author: GPT-6 / Codex (reasoning effort not exposed)
 * Date: 02-November-2026
 * PURPOSE: Check that initial article HTML distinguishes an unpublished address from
 * a rejected publication or failed archive read, without leaking internal details.
 * SRP/DRY check: Pass — exercises the real shared metadata renderer and archive contract.
 */
import { afterEach, expect, it, vi } from 'vitest';
import * as store from '../server/services/news/newsStore';
import { resolveNewsMeta } from '../server/services/news/newsPresentation';

afterEach(() => vi.restoreAllMocks());

it('opens the approved ARC2 article at its permanent address with the intended illustration', () => {
  const page = resolveNewsMeta('/news/2026-11-02-evening-arc-2')!;
  expect(page.status).toBe(200);
  expect(page.tags.bodyHtml?.replace(/<[^>]*>/g, '')).toContain('tascj storms the summit chase');
  expect(page.tags.bodyHtml).toContain('/news-images/2026-11-02-tascj-cyber-one-wingbeat-v1.webp');
});

it('highlights the verified infinity team in the initial article HTML', () => {
  const page = resolveNewsMeta('/news/2026-11-02-evening-arc-3')!;
  expect(page.status).toBe(200);
  expect(page.tags.bodyHtml).toContain('<strong class="news-team-name">Infinity</strong>');
  expect(page.tags.bodyHtml).toContain('<strong class="news-team-name">infinity</strong>');
});

it('gives an unpublished address a clear 404 and working retry and front-page links', () => {
  const page = resolveNewsMeta('/news/not-yet-published')!;
  expect(page.status).toBe(404);
  expect(page.tags.bodyHtml).toContain('This story isn’t here yet');
  expect(page.tags.bodyHtml).toContain('We may have gotten ahead of ourselves.');
  expect(page.tags.bodyHtml).toContain('href="/news/not-yet-published"');
  expect(page.tags.bodyHtml).toContain('href="/news"');
  expect(page.tags.noindex).toBe(true);
});

it.each(['articles', 'dispatches'])('gives a rejected %s publication a 503 without exposing its internal rejection', folder => {
  const archive = store.loadNewsArchive();
  vi.spyOn(store, 'loadNewsArchive').mockReturnValueOnce({ ...archive,
    skipped: [{ file: `${folder}/failed-story.json`, reason: 'Private internal diagnostic /private/runtime/path' }],
  });
  const page = resolveNewsMeta('/news/failed-story')!;
  expect(page.status).toBe(503);
  expect(page.tags.bodyHtml).toContain('We couldn’t load this story');
  expect(page.tags.bodyHtml).toContain('publication status could not be checked');
  expect(page.tags.bodyHtml).not.toContain('not been published');
  expect(page.tags.bodyHtml).not.toContain('/private/runtime/path');
  expect(page.tags.bodyHtml).not.toContain('Private internal diagnostic');
  expect(page.tags.bodyHtml).toContain('href="/news/failed-story"');
});

it('does not call an archive read failure an unpublished article', () => {
  vi.spyOn(store, 'loadNewsArchive').mockImplementationOnce(() => { throw new Error('/private/unreadable/archive'); });
  const page = resolveNewsMeta('/news/failed-story')!;
  expect(page.status).toBe(503);
  expect(page.tags.bodyHtml).toContain('We couldn’t load this story');
  expect(page.tags.bodyHtml).not.toContain('/private/unreadable/archive');
});

it('keeps missing card pages distinct from article publication states', () => {
  const page = resolveNewsMeta('/news/cards/no-such-card')!;
  expect(page.status).toBe(404);
  expect(page.tags.bodyHtml).toContain('Card not found');
});
