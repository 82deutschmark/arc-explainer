/**
 * Author: GPT-6.1 Sol / Codex; GPT-6 / Codex; GPT-6 Sol / Codex; Claude Opus 5.5 Max
 * Date: 15-October-2026
 * PURPOSE: Read the committed ARC Daily archive and competitor notebook for API and SEO
 *          rendering, including people, roster history and strictly public social sources. Validates JSON at the
 *          read boundary; never runs a model.
 *          09-Oct-2026 (Claude Opus 5.5): optional person portraits, traced to the person's own
 *          Kaggle account or Hall of Fame card; Hall of Fame art may be .jpeg or a spaced filename.
 *          Later the same day: wire-desk stories (content/news/wire), kept in step with
 *          scripts/newsroom_wire.py, which validates each story against its brief first.
 *          Serves only exported public tweet archives and read, dated Kaggle discussion leads.
 *          15-Oct-2026 (Claude Opus 5.5 Max): every file and ledger record is now checked on its own,
 *          the way wire stories already were. One bad edition, dispatch, person or post is left out
 *          and reported (loadNewsArchive().skipped, served at /api/news/health) instead of failing
 *          /api/news, the SEO pages and the market digest the wire desk depends on.
 * SRP/DRY check: Pass — one store serves HTML, JSON, feeds and sitemap discovery; the per-file and
 *          per-record readers replace three copies of the same parse-and-check loop.
 */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { NewsArticle, NewsIndex, NewsDispatch, CompetitorRecord, NewsWireStory } from '../../../shared/news';
import { NEWS_EDITION_WRITERS, NEWS_WIRE_WRITERS } from '../../../shared/news';
const stamp = z.string().datetime({ offset: true });
const webUrl = z.string().url().refine(value => /^https:\/\//.test(value), 'Sources must use HTTPS');
const competition = z.enum(['arc-3', 'arc-2']);
const safeId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/);
const text = z.string().min(1).max(20000);
export const newsDispatchSchema = z.object({
  id: safeId, competition, publishedAt: stamp, headline: text.max(240),
  generatedBy: z.enum(NEWS_EDITION_WRITERS).optional(),
  commissionedBy: z.literal('mark-barney').optional(), editorNote: text.max(700).optional(),
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
  frontPageFeatureId: safeId.optional(),
  image: z.object({ src: z.string().regex(/^\/news-images\/[a-z0-9-]+\.webp$/), alt: text.max(700), caption: text.max(700), artworkId: safeId }).strict().optional(),
  headline: text.max(240), dek: text.max(700), sections: z.array(z.object({ heading: text.optional(), text, sourceIds: z.array(z.string()).min(1), image: z.object({ src: z.string().regex(/^\/news-images\/[a-z0-9-]+\.(png|jpg|webp)$/), alt: text.max(700), caption: text.max(700) }).strict().optional() })).min(1),
  teamIds: z.array(z.string().regex(/^\d+$/)), sources: z.array(z.object({ id: text, title: text, url: webUrl, accessedAt: stamp })).min(1),
  publishedAt: stamp, dataAsOf: stamp, baselineAt: stamp.nullable(), generatedBy: z.enum(NEWS_EDITION_WRITERS),
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
export const newsDiscussionSchema = z.object({
  id: z.string().regex(/^\d+$/), competition, url: webUrl, title: text,
  author: z.string().regex(/^[A-Za-z0-9_]+$/), authorName: text,
  postedAt: stamp.nullable(), latestActivityAt: stamp.nullable(), checkedAt: stamp,
  commentCount: z.number().int().nonnegative(), visibility: z.literal('public'), bodyRead: z.literal(true),
  summary: text.max(1600), decision: z.literal('paper-lead'), reason: text.max(700), personIds: z.array(safeId),
}).strict().refine(thread => thread.url === `https://www.kaggle.com/competitions/arc-prize-2026-${thread.competition.replace('arc-', 'arc-agi-')}/discussion/${thread.id}`, 'Discussion URL must match its competition and ID')
  .refine(thread => !!(thread.postedAt || thread.latestActivityAt), 'Discussion needs an observed source date')
  .refine(thread => Date.parse(thread.checkedAt) <= Date.now() && [thread.postedAt, thread.latestActivityAt].every(value => !value || Date.parse(value) <= Date.parse(thread.checkedAt)), 'Future discussion source time')
  .refine(thread => !thread.postedAt || !thread.latestActivityAt || Date.parse(thread.postedAt) <= Date.parse(thread.latestActivityAt), 'Reversed discussion dates');
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
  generatedBy: z.enum(NEWS_WIRE_WRITERS),
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
/** A news file, or one record inside a ledger file, that the site is leaving out, and why. */
export interface NewsSkip { file: string; record?: string; reason: string }
// The archive is written by scheduled models several times a day and goes live on every push, with
// no build-time content check. So every file and ledger record is checked on its own: a bad one is
// left out, logged once and reported by /api/news/health (which the desk watchdog reads), and the
// rest of the paper, including the market digest the wire desk writes from, keeps working. The same
// contract is enforced strictly before publishing by scripts/newsroom*.py and by the content test.
const warned = new Set<string>();
function leaveOut(skipped: NewsSkip[], entry: NewsSkip) {
  skipped.push(entry);
  const key = `${entry.file}|${entry.record ?? ''}|${entry.reason}`;
  if (!warned.has(key)) {
    warned.add(key);
    console.warn(`[news] left out ${entry.file}${entry.record ? ` (${entry.record})` : ''}: ${entry.reason}`);
  }
}
const describeError = (error: unknown) => error instanceof Error ? error.message : String(error);
const describeIssues = (error: z.ZodError) => {
  const issue = error.issues[0];
  return issue ? `${issue.path.length ? `${issue.path.join('.')}: ` : ''}${issue.message}` : 'invalid record';
};
/** One-story-per-file folders (articles, dispatches, wire): every valid file whose name matches its ID. */
function readStoryFolder<T extends { id: string }>(directory: string, folder: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>, skipped: NewsSkip[]): T[] {
  const root = path.join(directory, folder);
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root).filter(file => file.endsWith('.json')).flatMap(file => {
    const label = `${folder}/${file}`;
    try {
      const parsed = schema.safeParse(JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')));
      if (!parsed.success) leaveOut(skipped, { file: label, reason: describeIssues(parsed.error) });
      else if (`${parsed.data.id}.json` !== file) leaveOut(skipped, { file: label, reason: 'filename does not match its ID' });
      else return [parsed.data];
    } catch (error) {
      leaveOut(skipped, { file: label, reason: `unreadable: ${describeError(error)}` });
    }
    return [];
  });
}
/** Ledger files holding a JSON array: every valid record, keeping the first of any duplicate key. */
function readLedger<T>(directory: string, file: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>, keyOf: (record: T) => string, skipped: NewsSkip[]): T[] {
  const target = path.join(directory, file);
  if (!fs.existsSync(target)) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch (error) {
    leaveOut(skipped, { file, reason: `unreadable: ${describeError(error)}` });
    return [];
  }
  if (!Array.isArray(raw)) {
    leaveOut(skipped, { file, reason: 'not a JSON array' });
    return [];
  }
  const seen = new Set<string>();
  return raw.flatMap((item, position) => {
    const label = item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string' ? (item as { id: string }).id : `item ${position}`;
    const parsed = schema.safeParse(item);
    if (!parsed.success) {
      leaveOut(skipped, { file, record: label, reason: describeIssues(parsed.error) });
      return [];
    }
    const key = keyOf(parsed.data);
    if (seen.has(key)) {
      leaveOut(skipped, { file, record: label, reason: `duplicate of an earlier record (${key})` });
      return [];
    }
    seen.add(key);
    return [parsed.data];
  });
}
/** The public archive plus anything that had to be left out of it. */
export function loadNewsArchive(directory = NEWS_DIRECTORY): { index: NewsIndex; skipped: NewsSkip[] } {
  const skipped: NewsSkip[] = [];
  const articles: NewsArticle[] = readStoryFolder(directory, 'articles', newsArticleSchema, skipped)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.competition.localeCompare(b.competition));
  const competitors: CompetitorRecord[] = readLedger(directory, 'competitors.json', competitorSchema, record => record.id, skipped);
  const dispatches: NewsDispatch[] = readStoryFolder(directory, 'dispatches', newsDispatchSchema, skipped)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id.localeCompare(a.id));
  // A verified account names one person; a later record claiming an earlier person's account is left out whole.
  const claimed = new Set<string>();
  const people = readLedger(directory, 'people.json', newsPersonSchema, person => person.id, skipped).filter(person => {
    const accounts = person.accounts.map(account => `${account.platform}:${account.handle.toLowerCase()}`);
    const taken = accounts.find(account => claimed.has(account));
    if (taken) {
      leaveOut(skipped, { file: 'people.json', record: person.id, reason: `verified account ${taken} already belongs to another person` });
      return false;
    }
    accounts.forEach(account => claimed.add(account));
    return true;
  });
  const social = readLedger(directory, 'social.json', newsSocialSchema, post => post.id, skipped);
  // Only the explicitly exported public archive is served. The private research state is never read here.
  const socialArchive = readLedger(directory, 'social-archive.json', newsSocialSchema, post => post.id, skipped)
    .filter(post => post.postedAt && Date.now() - Date.parse(post.postedAt) <= 30 * 24 * 3_600_000);
  const discussions = readLedger(directory, 'discussions.json', newsDiscussionSchema, thread => `${thread.competition}:${thread.id}`, skipped)
    .filter(thread => Date.now() - Date.parse(thread.latestActivityAt ?? thread.postedAt!) <= WIRE_WINDOW_MS);
  // The index the front page refetches every minute carries the past week of wire, at most 40 stories;
  // the files stay in git as the permanent record and keep their evidence route.
  const wire: NewsWireStory[] = readStoryFolder(directory, 'wire', newsWireSchema, skipped)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id.localeCompare(a.id))
    .filter(story => Date.now() - Date.parse(story.publishedAt) <= WIRE_WINDOW_MS).slice(0, WIRE_LIMIT);
  return { index: { articles, competitors, dispatches, people, social, socialArchive, discussions, wire }, skipped };
}
export function getNewsIndex(directory = NEWS_DIRECTORY): NewsIndex {
  return loadNewsArchive(directory).index;
}
