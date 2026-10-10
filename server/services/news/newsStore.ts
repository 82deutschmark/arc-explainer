/**
 * Author: GPT-6 Sol / Codex
 * Date: 2026-10-09
 * PURPOSE: Read the committed ARC Daily archive and competitor notebook for API and SEO
 *          rendering, including people, roster history and strictly public social sources. Validates JSON at the
 *          read boundary; never runs a model.
 *          09-Oct-2026 (Claude Opus 5.5): optional person portraits, traced to the person's own
 *          Kaggle account or Hall of Fame card; Hall of Fame art may be .jpeg or a spaced filename.
 *          Later the same day: wire-desk stories (content/news/wire), kept in step with
 *          scripts/newsroom_wire.py, which validates each story against its brief first.
 * SRP/DRY check: Pass — one store serves HTML, JSON, feeds and sitemap discovery.
 */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { NewsArticle, NewsIndex, NewsDispatch, CompetitorRecord, NewsWireStory } from '../../../shared/news';
const stamp = z.string().datetime({ offset: true });
const webUrl = z.string().url().refine(value => /^https:\/\//.test(value), 'Sources must use HTTPS');
const competition = z.enum(['arc-3', 'arc-2']);
const safeId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/);
const text = z.string().min(1).max(20000);
export const newsDispatchSchema = z.object({
  id: safeId, competition, publishedAt: stamp, headline: text.max(240),
  sections: z.array(z.object({ heading: text.optional(), text: text.max(2500), sourceIds: z.array(z.string()).min(1) })).min(1).max(5),
  sources: z.array(z.object({ id: text, title: text, url: webUrl, accessedAt: stamp })).min(1),
  interpretation: text.max(700).optional(),
  image: z.object({ src: z.string().regex(/^\/news-images\/[a-z0-9-]+\.(png|jpg|webp)$/), alt: text.max(700), caption: text.max(700) }).optional(),
}).strict().superRefine((dispatch, context) => {
  const sources = new Set(dispatch.sources.map(source => source.id));
  if (sources.size !== dispatch.sources.length || dispatch.sections.some(section => section.sourceIds.some(id => !sources.has(id)))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Dispatch requires unique sources and valid citations' });
  }
  const published = Date.parse(dispatch.publishedAt);
  if (published > Date.now() || dispatch.sources.some(source => Date.parse(source.accessedAt) > published)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Dispatch publication and source checks cannot be in the future' });
  }
});
export const newsArticleSchema = z.object({
  id: safeId, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), edition: z.enum(['morning', 'evening']), competition,
  headline: text.max(240), dek: text.max(700), sections: z.array(z.object({ heading: text.optional(), text, sourceIds: z.array(z.string()).min(1) })).min(1),
  teamIds: z.array(z.string().regex(/^\d+$/)), sources: z.array(z.object({ id: text, title: text, url: webUrl, accessedAt: stamp })).min(1),
  publishedAt: stamp, dataAsOf: stamp, baselineAt: stamp.nullable(), generatedBy: z.enum(['gpt-6-sol', 'claude-haiku-5-5']),
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
const factSchema = z.object({ text, sourceUrl: webUrl, sourceTitle: text, checkedAt: stamp }).strict();
// Kept in step with scripts/newsroom_people.py, which validates the same ledger before publishing.
const HALL_OF_FAME_PATH = /^\/hall-of-fame(?:#contributor-\d+|\/johan-land)?$/;
/** Existing Hall of Fame card art in client/public, e.g. /jfPuget3.png, /jackcole.jpeg, /arc founders.png. */
const HALL_OF_FAME_ART = /^\/[A-Za-z0-9_-]+(?: [A-Za-z0-9_-]+)*\.(?:png|jpe?g)$/;
const PORTRAIT_FILE = /^\/news-images\/people\/[a-z0-9-]+\.(?:webp|png|jpe?g)$/;
const HALL_OF_FAME_ORIGIN = 'https://arc.markbarney.net';
export const newsPersonSchema = z.object({
  id: safeId, name: text,
  accounts: z.array(z.object({ platform: z.enum(['kaggle', 'x']), handle: z.string().regex(/^[A-Za-z0-9_]+$/), url: webUrl, sourceUrl: webUrl, sourceTitle: text, checkedAt: stamp }).strict()
    .refine(account => account.url.toLowerCase() === `https://${account.platform === 'kaggle' ? 'www.kaggle.com' : 'x.com'}/${account.handle}`.toLowerCase(), 'Account URL and handle must agree')).min(1),
  facts: z.array(factSchema),
  memberships: z.array(z.object({ competition, competitionId: text, season: z.string().regex(/^\d{4}$/), teamId: z.string().regex(/^\d+$/), teamName: text, memberHandle: text, firstObservedAt: stamp, lastObservedAt: stamp, sourceUrl: webUrl, sourceTitle: text }).strict()
    .refine(member => Date.parse(member.firstObservedAt) <= Date.parse(member.lastObservedAt), 'Reversed membership observations')
    .refine(member => member.competitionId === `arc-prize-${member.season}-${member.competition.replace('arc-', 'arc-agi-')}`, 'Membership competition and season must agree')),
  hallOfFame: z.array(z.object({ path: z.string().regex(HALL_OF_FAME_PATH), label: text, sourceUrl: webUrl, sourceTitle: text, checkedAt: stamp,
    image: z.object({ src: z.string().regex(HALL_OF_FAME_ART), alt: text.max(700) }).strict().optional() }).strict()),
  portrait: z.object({ src: z.string().regex(PORTRAIT_FILE), alt: text.max(700), kind: z.enum(['hall-of-fame', 'kaggle']), sourceUrl: webUrl, sourceTitle: text, checkedAt: stamp }).strict().optional(),
}).strict().superRefine((person, context) => {
  const accounts = person.accounts.map(account => `${account.platform}:${account.handle.toLowerCase()}`);
  const memberships = person.memberships.map(member => `${member.competitionId}:${member.teamId}:${member.memberHandle}`);
  if (new Set(accounts).size !== accounts.length || new Set(memberships).size !== memberships.length || person.memberships.some(member => !person.accounts.some(account => account.platform === 'kaggle' && account.handle === member.memberHandle))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate identity or membership without a verified account' });
  }
  // A face must trace to the person's own verified Kaggle account or one of their own Hall of Fame cards.
  const portrait = person.portrait;
  if (portrait && !(portrait.kind === 'kaggle'
    ? person.accounts.some(account => account.platform === 'kaggle' && account.url.toLowerCase() === portrait.sourceUrl.toLowerCase())
    : person.hallOfFame.some(card => `${HALL_OF_FAME_ORIGIN}${card.path}` === portrait.sourceUrl))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Portrait must come from the person’s verified Kaggle account or their own Hall of Fame card' });
  }
});
export const newsSocialSchema = z.object({
  id: z.string().regex(/^\d+$/), author: z.string().regex(/^[A-Za-z0-9_]{1,15}$/), authorName: text,
  url: webUrl, postedAt: stamp.nullable(), checkedAt: stamp, visibility: z.literal('public'),
  summary: text.max(1200), whyItMatters: text.max(700), competitions: z.array(competition), personIds: z.array(safeId),
  category: z.enum(['standings', 'research', 'community', 'banter']), importance: z.number().int().min(1).max(3),
  threadId: z.string().regex(/^\d+$/).nullable(), storyUrl: webUrl.nullable(), identitySourceUrl: webUrl,
}).strict().refine(post => post.url.toLowerCase() === `https://x.com/${post.author}/status/${post.id}`.toLowerCase(), 'Post URL and author must agree')
  .refine(post => Date.parse(post.checkedAt) <= Date.now() && (!post.postedAt || Date.parse(post.postedAt) <= Date.parse(post.checkedAt)), 'Future social source time');
const WIRE_WINDOW_MS = 7 * 24 * 3_600_000;
const WIRE_LIMIT = 40;
/** Wire story IDs: Eastern date and time of filing, competition, then a slug ("2026-10-10-0905-arc-3-mtg-climbs"). */
export const WIRE_ID = /^\d{4}-\d{2}-\d{2}-\d{4}-arc-[23]-[a-z0-9][a-z0-9-]{0,59}$/;
/** A wire picture is one the brief offered: a ledger face, Hall of Fame card art or a published dispatch illustration. */
const WIRE_PICTURE = new RegExp(`${PORTRAIT_FILE.source}|${HALL_OF_FAME_ART.source}|^\\/news-images\\/[a-z0-9-]+\\.(?:png|jpg|webp)$`);
export const newsWireSchema = z.object({
  id: z.string().regex(WIRE_ID), competition, publishedAt: stamp, dataAsOf: stamp, since: stamp.nullable(),
  headline: text.max(160),
  sections: z.array(z.object({ heading: text.max(120).optional(), text: text.max(900), sourceIds: z.array(z.string()).min(1) }).strict()).min(1).max(3),
  sources: z.array(z.object({ id: text, title: text, url: webUrl, accessedAt: stamp }).strict()).min(1),
  teamIds: z.array(z.string().regex(/^\d+$/)), personIds: z.array(safeId),
  // Same caption limit as the ledger pictures it copies, so a valid offered picture can never fail here.
  visual: z.object({ src: z.string().regex(WIRE_PICTURE), alt: text.max(700), href: z.string().regex(/^\/[^\s]*$/) }).strict().optional(),
  generatedBy: z.enum(['gpt-6-luna', 'claude-haiku-5-5']),
}).strict().superRefine((story, context) => {
  const sources = new Set(story.sources.map(source => source.id));
  if (sources.size !== story.sources.length || story.sections.some(section => section.sourceIds.some(id => !sources.has(id)))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Wire story requires unique sources and valid citations' });
  }
  if (!story.id.includes(`-${story.competition}-`)) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Wire story ID must name its competition' });
  const published = Date.parse(story.publishedAt);
  if (published > Date.now() || Date.parse(story.dataAsOf) > published || (story.since && Date.parse(story.since) > Date.parse(story.dataAsOf))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Wire story times are out of order or in the future' });
  }
});
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
  const dispatchDirectory = path.join(directory, 'dispatches');
  const dispatches: NewsDispatch[] = fs.existsSync(dispatchDirectory) ? fs.readdirSync(dispatchDirectory)
    .filter(file => /^[a-z0-9][a-z0-9-]{0,99}\.json$/.test(file)).map(file => {
      const dispatch = newsDispatchSchema.parse(JSON.parse(fs.readFileSync(path.join(dispatchDirectory, file), 'utf8')));
      if (`${dispatch.id}.json` !== file) throw new Error(`Dispatch filename does not match its ID: ${file}`);
      return dispatch;
    }).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id.localeCompare(a.id)) : [];
  const readArray = <T>(file: string, schema: z.ZodType<T>) => fs.existsSync(path.join(directory, file)) ? z.array(schema).parse(JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'))) : [];
  const people = readArray('people.json', newsPersonSchema);
  const social = readArray('social.json', newsSocialSchema);
  if (new Set(people.map(person => person.id)).size !== people.length || new Set(social.map(post => post.id)).size !== social.length) throw new Error('Duplicate news person or social post');
  const accounts = people.flatMap(person => person.accounts.map(account => `${account.platform}:${account.handle.toLowerCase()}`));
  if (new Set(accounts).size !== accounts.length) throw new Error('A verified account belongs to multiple people');
  // Wire stories come from a scheduled small model several times a day. scripts/newsroom_wire.py
  // checks the same contract first; a file that still fails is left out, so one bad story can never
  // take the whole paper down the way a bad edition would.
  const wireDirectory = path.join(directory, 'wire');
  const wire: NewsWireStory[] = fs.existsSync(wireDirectory) ? fs.readdirSync(wireDirectory)
    .filter(file => file.endsWith('.json')).flatMap(file => {
      try {
        const story = newsWireSchema.safeParse(JSON.parse(fs.readFileSync(path.join(wireDirectory, file), 'utf8')));
        if (story.success && `${story.data.id}.json` === file) return [story.data];
        console.warn(`[news] skipped wire story ${file}: ${story.success ? 'filename does not match its ID' : story.error.issues[0]?.message}`);
      } catch (error) {
        console.warn(`[news] skipped unreadable wire story ${file}: ${error instanceof Error ? error.message : error}`);
      }
      return [];
    }).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id.localeCompare(a.id))
    // The index the front page refetches every minute carries the past week, at most 40 stories;
    // the files stay in git as the permanent record and keep their evidence route.
    .filter(story => Date.now() - Date.parse(story.publishedAt) <= WIRE_WINDOW_MS).slice(0, WIRE_LIMIT) : [];
  return { articles, competitors, dispatches, people, social, wire };
}
