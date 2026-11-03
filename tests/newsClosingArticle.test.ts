/**
 * Author: GPT-6.1 Terra / Codex (reasoning effort not exposed)
 * Date: 03-November-2026
 * PURPOSE: Verify the actual closing story survives validation and retains both dated
 * standings and pictures in client sections, permanent-route HTML and the front page.
 * SRP/DRY check: Pass — exercises the shared article contract and production renderers.
 */
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { NewsArticle } from '../shared/news';
import { newsArticleSchema } from '../server/services/news/newsStore';
import { resolveNewsMeta } from '../server/services/news/newsPresentation';
import { NewsArticleSectionExtras } from '../client/src/components/news/NewsArticleSectionExtras';

const article = JSON.parse(readFileSync('content/news/articles/2026-11-03-closing-bell.json', 'utf8')) as NewsArticle;
const evidence = JSON.parse(readFileSync('content/news/evidence/2026-11-03-closing-bell.json', 'utf8'));

describe('closing story as readers receive it', () => {
  it('passes the live archive contract with accurate writer credit', () => {
    expect(newsArticleSchema.parse(article).generatedBy).toBe('gpt-6-codex');
    expect(resolveNewsMeta(`/news/${article.id}`)?.status).toBe(200);
  });

  it('keeps both dated public boards and pictures in section and server views', () => {
    const sections = article.sections.filter(section => section.standings);
    expect(sections).toHaveLength(2);
    const initial = resolveNewsMeta(`/news/${article.id}`)!.tags.bodyHtml!;
    const front = resolveNewsMeta('/news')!.tags.bodyHtml!;
    for (const [section, competition] of sections.map((value, index) => [value, index === 0 ? 'arc-3' : 'arc-2'] as const)) {
      const board = section.standings!;
      const client = renderToStaticMarkup(React.createElement(NewsArticleSectionExtras, { section }));
      expect(board.rows).toHaveLength(10);
      expect(board.observedAt).toBe(evidence.observations[competition].dataAsOf);
      expect(client).toContain(board.observedAt);
      expect(initial).toContain(board.observedAt);
      expect(front).toContain(board.observedAt);
      for (const row of board.rows) {
        expect(initial).toContain(row.name.replaceAll('&', '&amp;'));
        expect(client).toContain(row.name.replaceAll('&', '&amp;'));
      }
    }
    for (const path of [article.image!.src, sections[1].image!.src]) {
      expect(initial).toContain(path);
      expect(front).toContain(path);
    }
    expect(initial).toContain('news-team-name');
    expect(initial).not.toContain('From the box score</h2><table');
  });
});
