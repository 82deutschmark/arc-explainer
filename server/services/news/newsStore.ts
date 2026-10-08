/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-07
 * PURPOSE: Read the committed ARC Daily archive and competitor notebook for API and SEO
 *          rendering. Validates public JSON at the read boundary; never runs a model.
 * SRP/DRY check: Pass — one store serves HTML, JSON, feeds and sitemap discovery.
 */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { NewsArticle, NewsIndex, CompetitorRecord } from '../../../shared/news';
const stamp = z.string().datetime({ offset: true });
const webUrl = z.string().url().refine(value => /^https:\/\//.test(value), 'Sources must use HTTPS');
const competition = z.enum(['arc-3', 'arc-2']);
const safeId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/);
const text = z.string().min(1).max(20000);
export const newsArticleSchema = z.object({
  id: safeId, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), edition: z.enum(['morning', 'evening']), competition,
  headline: text.max(240), dek: text.max(700), sections: z.array(z.object({ heading: text.optional(), text, sourceIds: z.array(z.string()).min(1) })).min(1),
  teamIds: z.array(z.string().regex(/^\d+$/)), sources: z.array(z.object({ id: text, title: text, url: webUrl, accessedAt: stamp })).min(1),
  publishedAt: stamp, dataAsOf: stamp, baselineAt: stamp.nullable(), generatedBy: z.literal('gpt-6-sol'),
  stats: z.array(z.object({ teamId: z.string().regex(/^\d+$/), name: text, rank: z.number().int().positive(), score: z.number().finite(), rankChange: z.number().int().nullable(), scoreChange: z.number().finite().nullable() })),
  coverageNote: text, discord: text.max(1900),
}).superRefine((article, context) => {
  const sources = new Set(article.sources.map(source => source.id));
  if (sources.size !== article.sources.length) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate source IDs' });
  if (article.sections.some(section => section.sourceIds.some(id => !sources.has(id)))) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Unknown source citation' });
});
export const competitorSchema = z.object({
  id: safeId, competition, teamId: z.string().regex(/^\d+$/), name: text,
  aliases: z.array(z.string()), members: z.array(z.string()), firstObservedAt: stamp, lastObservedAt: stamp,
  facts: z.array(z.object({ text, sourceUrl: webUrl, sourceTitle: text, checkedAt: stamp })),
}).refine(record => record.id === `${record.competition}-${record.teamId}`, 'Competitor IDs must include competition');
export const NEWS_DIRECTORY = path.join(process.cwd(), 'content/news');
export function getNewsIndex(directory = NEWS_DIRECTORY): NewsIndex {
  const articlesDirectory = path.join(directory, 'articles');
  const articles: NewsArticle[] = fs.existsSync(articlesDirectory) ? fs.readdirSync(articlesDirectory)
    .filter(file => /^[a-z0-9][a-z0-9-]{0,99}\.json$/.test(file)).map(file => {
      const article = newsArticleSchema.parse(JSON.parse(fs.readFileSync(path.join(articlesDirectory, file), 'utf8')));
      if (`${article.id}.json` !== file) throw new Error(`Article filename does not match its ID: ${file}`);
      return article;
    }).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.competition.localeCompare(b.competition)) : [];
  const notebook = path.join(directory, 'competitors.json');
  const competitors: CompetitorRecord[] = fs.existsSync(notebook) ? z.array(competitorSchema).parse(JSON.parse(fs.readFileSync(notebook, 'utf8'))) : [];
  if (new Set(competitors.map(record => record.id)).size !== competitors.length) throw new Error('Duplicate competitor identities');
  return { articles, competitors };
}
