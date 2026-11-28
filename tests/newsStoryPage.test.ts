/**
 * Author: Claude Opus 5.5 Medium
 * Date: 27-November-2026
 * 27-Nov-2026 (Claude Opus 5.5 Medium): new. Checks the three-column story page the Boss approved on 27 November:
 *          the typed board read into a real table, the subject's row marked, numbered notes in first-citation order,
 *          the contest wire, the editor's box, and the browser page and server HTML printing the parts in one order.
 * PURPOSE: Guard shared/storyPage.ts (typedBoards, storyBoards, storyNotes, storyWire), NewsStoryPage.tsx and the
 *          server's storyPageHtml against drift, using the published Franzen, opening-board and Keith Tyser stories.
 * SRP/DRY check: Pass. Reads the committed archive through the same store the site uses; no fixtures invented.
 */
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { Router, Route } from 'wouter';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NewsArticle from '../client/src/pages/NewsArticle';
import { resolveNewsMeta } from '../server/services/news/newsPresentation';
import { getNewsCollection } from '../server/services/news/newsCollection';
import { getNewsIndex } from '../server/services/news/newsStore';
import { storyBoards, storyNotes, storyWire, typedBoards, STORY_ARC_ARCHIVE } from '../shared/storyPage';
import { NEWS_HUMAN_EDITOR } from '../shared/newsStaff';
import type { NewsIndex } from '../shared/news';

function render(path: string, index: NewsIndex) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, queryFn: () => new Promise(() => {}) } } });
  client.setQueryData(['/api/news'], index);
  client.setQueryData(['/api/news/cards'], getNewsCollection());
  client.setQueryData(['/api/news/stories', path.split('/').pop()], index);
  return renderToStaticMarkup(createElement(QueryClientProvider, { client },
    createElement(HelmetProvider, {}, createElement(Router, { ssrPath: path, children: createElement(Route, { path: '/news/:articleId', component: NewsArticle }) }))));
}
afterEach(() => vi.unstubAllGlobals());

const index = getNewsIndex();
const dispatch = (id: string) => index.dispatches!.find(item => item.id === id)!;

describe('the story page', () => {
  it('reads the Franzen board section into a table and keeps its words', () => {
    const section = dispatch('daniel-franzen-arcade-entrance').sections.find(item => item.heading === 'The public board')!;
    const { boards, prose } = typedBoards(section.text);
    expect(boards).toHaveLength(1);
    expect(boards[0].columns).toEqual(['Score', 'Entries', 'Last entry']);
    expect(boards[0].caption).toMatch(/^Generalist Gaming public board · 28 November 2026, 01:13 UTC/);
    expect(boards[0].rows.map(row => [row.place, row.team, ...row.fields])).toEqual([
      [1, 'Daniel Franzen', '0.554', '6', '17:11'], [2, 'Keith Tyser', '0.477', '13', '11:10'], [3, 'Dries @ Tufa Labs', '0.401', '15', '18:57'],
      [4, 'Mevlana Yalçın', '0.400', '7', '18:37'], [5, 'Pay-to-Compute', '0.365', '17', '17:25']]); // the 28 Nov correction cut Jack Cole's row
    // The table, its header and its caption move to the board column; the closing words stay in the story.
    expect(prose).not.toMatch(/#1|Place · Team/);
    expect(prose).toMatch(/^The private board sets the final ranking\./);
  });

  it('marks the subject on the board and puts the newer of two reads first', () => {
    const [franzen] = storyBoards([dispatch('daniel-franzen-arcade-entrance')], index.people);
    expect(franzen.rows.filter(row => row.subject).map(row => row.team)).toEqual(['Daniel Franzen']);
    const opening = storyBoards([dispatch('generalist-gaming-opening-board')], index.people);
    expect(opening).toHaveLength(2);
    expect(opening[0].caption).toMatch(/25 November 2026/); // the newer read, Wednesday evening
    expect(opening[0].rows[0].team).toBe('Keith Tyser');
    expect(opening[1].rows[0].team).toBe('Tong Hui Kang');
    // Keith's story prints no board, so its board column starts with the cards.
    expect(storyBoards([dispatch('keith-tyser-arcade')], index.people)).toEqual([]);
  });

  it('numbers each cited source once, in first-citation order, with the numbers after each section', () => {
    const story = dispatch('daniel-franzen-arcade-entrance');
    const { notes, refs } = storyNotes([story]);
    expect(notes.map(note => note.number)).toEqual(notes.map((_, position) => position + 1));
    expect(new Set(notes.map(note => note.source.url)).size).toBe(notes.length);
    expect(refs[0][0][0]).toBe(1); // the opening section cites the first source first
    expect(refs[0].flat().every(number => number >= 1 && number <= notes.length)).toBe(true);
  });

  it('lists the contest’s other stories newest first, then elsewhere, then the ARC archive', () => {
    const story = dispatch('daniel-franzen-arcade-entrance');
    const wire = storyWire(story, index.articles, index.dispatches);
    expect(wire.contest.length).toBeGreaterThan(0);
    expect(wire.contest.map(item => item.id)).not.toContain(story.id);
    expect(wire.contest.every(item => item.competition === 'Generalist Gaming Agent')).toBe(true);
    expect([...wire.contest.map(item => item.publishedAt)]).toEqual([...wire.contest.map(item => item.publishedAt)].sort().reverse());
    expect(wire.contest.slice(2).every(item => !item.image)).toBe(true);
    expect(wire.elsewhere.every(item => item.competition !== 'Generalist Gaming Agent')).toBe(true);
    expect(wire.archive.href).toBe(STORY_ARC_ARCHIVE.path);
  });

  it('prints story, board, cards, editor, notes and wire in the same order in the browser page and the server HTML', () => {
    vi.stubGlobal('React', React);
    const path = '/news/daniel-franzen-arcade-entrance';
    const client = render(path, index);
    const server = resolveNewsMeta(path)!.tags.bodyHtml!;
    for (const html of [client, server]) {
      const order = [
        html.indexOf('Franzen swipes the arcade lead'), html.indexOf('Pay-to-Compute'), html.indexOf('aria-label="In this story"'),
        html.indexOf(NEWS_HUMAN_EDITOR.role), html.indexOf('id="note-1"'), html.indexOf('aria-label="More from'),
      ];
      expect(order.every(at => at > -1)).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
      expect(html).toContain(NEWS_HUMAN_EDITOR.line);
      expect(html).toContain('href="#note-1"');
      expect(html).toContain('class="is-subject"');
    }
    expect(NEWS_HUMAN_EDITOR.role).toBe('Editor-in-Chief · Head Meat Proxy');
  });
});
