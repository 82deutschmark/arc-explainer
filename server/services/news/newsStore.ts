/**
 * Author: GPT-6.1 Terra / Codex; GPT-6 / Codex (reasoning effort not exposed); GPT-6.1 Sol / Codex; GPT-6 / Codex; GPT-6 Sol / Codex; Claude Opus 5.5 Max; Claude Opus 5.5
 * Date: 14-Nov-2026
 * 14-Nov-2026 (Claude Opus 5.5): From X posts older than a week leave the index, like discussions and wire.
 * 14-Nov-2026 (Claude Opus 5.5): loadWireStory reads one wire story by ID for its permanent page, whatever its
 *          age; while the desk has filed nothing for a week the index carries its newest filings (wireLatest).
 * 14-Nov-2026 (Claude Opus 5.5, profiles-articles): editions may name further competitions; editions published from
 *          1 Nov 2026 must cite every source; revision records (content/news/corrections and the editorial/reporting
 *          revision evidence) load into revisions/updatedAt; an edition whose board or sources postdate both its
 *          publication and its latest revision is left out; file-name alt text is rejected; socialArchive removed.
 * 09-Nov-2026: Tufa cast and card correction by GPT-6.1 Sol / Codex (effort inherited).
 * 09-Nov-2026 (GPT-6 / Codex): verified story casts and per-contest team card evidence.
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
import { NEWS_EDITION_WRITERS, NEWS_WIRE_WRITERS, WIRE_WINDOW_MS, WIRE_PAUSED_LIMIT, isFilenameAlt, type NewsRevision } from '../../../shared/news';
import { KAGGLE_COMPETITIONS, competitionRegistered } from '../../../shared/kaggleCompetitions';
import { loadWikiInputs, mergeWikiRows, mergeCompetitorRows } from './wikiInputs';
const stamp = z.string().datetime({ offset: true });
const webUrl = z.string().url().refine(value => /^https:\/\//.test(value), 'Sources must use HTTPS');
const competition = z.string().refine(competitionRegistered, 'Competition is not in the publication directory');
const safeId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/);
const text = z.string().min(1).max(20000);
const castIds = z.array(safeId).refine(ids => new Set(ids).size === ids.length, 'Cast IDs must be unique');
const archiveCastSchema = z.object({ id: safeId, personIds: castIds }).strict();
/** Alt text must describe the picture; a file name or asset slug ("keith-tyser.webp") describes nothing. */
const readableAlt = text.max(700).refine(alt => !isFilenameAlt(alt), 'Alt text must describe the picture, not name its file');
/** Editions published from the 1 Nov 2026 source clean-up on must cite every source they list. Older editions
 *  keep their brief catalogues on file; readers only ever see the cited ones (shared/news.ts citedSources). */
export const CITED_SOURCES_REQUIRED_FROM = '2026-11-01T00:00:00Z';
/** Stories record publication to the second while brief tools stamp sources to the microsecond, so compare whole seconds. */
const notAfter = (value: string, limit: number) => Math.floor(Date.parse(value) / 1000) <= Math.floor(limit / 1000);
export const newsDispatchSchema = z.object({
  id: safeId, competition, publishedAt: stamp, headline: text.max(240), dek: text.max(700).optional(),
  personIds: castIds.optional(),
  generatedBy: z.enum(NEWS_EDITION_WRITERS).optional(),
  commissionedBy: z.literal('mark-barney').optional(), editorNote: text.max(700).optional(),
  sections: z.array(z.object({ heading: text.optional(), text: text.max(2500), sourceIds: z.array(z.string()).min(1) })).min(1).max(5),
  sources: z.array(z.object({ id: text, title: text, url: webUrl, accessedAt: stamp })).min(1),
  interpretation: text.max(700).optional(),
  image: z.object({ src: z.string().regex(/^\/news-images\/[a-z0-9-]+\.(png|jpg|webp)$/), alt: readableAlt, caption: text.max(700) }).optional(),
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
  competitionDisplay: text.max(100).optional(), editionDisplay: text.max(100).optional(),
  frontPageFeatureId: safeId.optional(), personIds: castIds.optional(), competitions: z.array(competition).max(10).optional(),
  image: z.object({ src: z.string().regex(/^\/news-images\/[a-z0-9-]+\.webp$/), alt: readableAlt, caption: text.max(700), artworkId: safeId }).strict().optional(),
  headline: text.max(240), dek: text.max(700), sections: z.array(z.object({ heading: text.optional(), text, sourceIds: z.array(z.string()).min(1), image: z.object({ src: z.string().regex(/^\/news-images\/[a-z0-9-]+\.(png|jpg|webp)$/), alt: readableAlt, caption: text.max(700), layout: z.literal("inset").optional() }).strict().optional(), standings: z.object({ caption: text.max(300), observedAt: stamp, rows: z.array(z.object({ teamId: z.string().regex(/^\d+$/), name: text, rank: z.number().int().positive(), score: z.number().finite() }).strict()).min(1).max(100) }).strict().optional() })).min(1),
  teamIds: z.array(z.string().regex(/^\d+$/)), verifiedTeamNames: z.array(text.max(200)).max(100).optional(), sources: z.array(z.object({ id: text, title: text, url: webUrl, accessedAt: stamp })).min(1),
  publishedAt: stamp, dataAsOf: stamp, baselineAt: stamp.nullable(), generatedBy: z.enum(NEWS_EDITION_WRITERS),
  stats: z.array(z.object({ teamId: z.string().regex(/^\d+$/), name: text, rank: z.number().int().positive(), score: z.number().finite(), rankChange: z.number().int().nullable(), scoreChange: z.number().finite().nullable() })),
  coverageNote: text, discord: text.max(1900),
}).superRefine((article, context) => {
  const sources = new Set(article.sources.map(source => source.id));
  if (sources.size !== article.sources.length) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate source IDs' });
  if (article.sections.some(section => section.sourceIds.some(id => !sources.has(id)))) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Unknown source citation' });
  if (Date.parse(article.publishedAt) > Date.now()) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Edition publication cannot be in the future' });
  if (Date.parse(article.publishedAt) >= Date.parse(CITED_SOURCES_REQUIRED_FROM)) {
    const cited = new Set(article.sections.flatMap(section => section.sourceIds));
    const uncited = article.sources.filter(source => !cited.has(source.id)).map(source => source.id);
    if (uncited.length) context.addIssue({ code: z.ZodIssueCode.custom, message: `Sources no section cites: ${uncited.slice(0, 5).join(', ')}` });
  }
});
/**
 * Time order, as dispatches and wire stories already check it: the board (dataAsOf), every standings table and
 * every source must have been read by the time the edition went out, or by its latest recorded revision when it
 * was revised afterwards (the Mostik investigation and the 2 Nov morning edition gained later readings that way).
 * Returns why the edition is out of order, or null.
 */
export function articleTimeOrderIssue(article: Pick<NewsArticle, 'publishedAt' | 'dataAsOf' | 'baselineAt' | 'sources' | 'sections'>, revisions: NewsRevision[] = []): string | null {
  const limit = Math.max(Date.parse(article.publishedAt), ...revisions.map(revision => Date.parse(revision.at)).filter(Number.isFinite));
  if (!notAfter(article.dataAsOf, limit)) return `board read ${article.dataAsOf} after publication and every revision`;
  if (article.baselineAt && Date.parse(article.baselineAt) > Date.parse(article.dataAsOf)) return 'comparison board is newer than the board it compares';
  const late = article.sources.find(source => !notAfter(source.accessedAt, limit));
  if (late) return `source ${late.id} read ${late.accessedAt} after publication and every revision`;
  const table = article.sections.find(section => section.standings && !notAfter(section.standings.observedAt, limit));
  return table ? `standings observed ${table.standings!.observedAt} after publication and every revision` : null;
}
export const competitorSchema = z.object({
  id: safeId, competition, teamId: z.string().regex(/^\d+$/), name: text,
  briefing: text.optional(),
  aliases: z.array(z.string()), members: z.array(z.string()), firstObservedAt: stamp, lastObservedAt: stamp,
  facts: z.array(z.object({ text, sourceUrl: webUrl, sourceTitle: text, checkedAt: stamp })),
  art: z.object({ src: z.string().regex(/^\/news-images\/[A-Za-z0-9_\/.-]+\.(?:webp|png|jpe?g)$/), alt: readableAlt, caption: text }).optional(),
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
  id: safeId, name: text, role: z.enum(['competitor', 'sponsor']).optional(),
  briefing: text.optional(),
  accounts: z.array(z.object({ platform: z.enum(['kaggle', 'x']), handle: z.string().regex(/^[A-Za-z0-9_]+$/), url: webUrl, sourceUrl: webUrl, sourceTitle: text, checkedAt: stamp }).strict()
    .refine(account => account.url.toLowerCase() === `https://${account.platform === 'kaggle' ? 'www.kaggle.com' : 'x.com'}/${account.handle}`.toLowerCase(), 'Account URL and handle must agree')).min(1),
  facts: z.array(factSchema),
  memberships: z.array(z.object({ competition, competitionId: text, season: z.string().regex(/^\d{4}$/), teamId: z.string().regex(/^\d+$/), teamName: text, memberHandle: text, firstObservedAt: stamp, lastObservedAt: stamp, sourceUrl: webUrl, sourceTitle: text }).strict()
    .refine(member => Date.parse(member.firstObservedAt) <= Date.parse(member.lastObservedAt), 'Reversed membership observations')
    .refine(member => member.competitionId === KAGGLE_COMPETITIONS[member.competition]?.slug, 'Membership competition identity must agree')),
  hallOfFame: z.array(z.object({ path: z.string().regex(HALL_OF_FAME_PATH), label: text, sourceUrl: webUrl, sourceTitle: text, checkedAt: stamp,
    image: z.object({ src: z.string().regex(HALL_OF_FAME_ART), alt: text.max(700) }).strict().optional() }).strict()),
  portrait: z.object({ src: z.string().regex(PORTRAIT_FILE), alt: text.max(700), kind: z.enum(['hall-of-fame', 'kaggle', 'web']), sourceUrl: webUrl, sourceTitle: text, checkedAt: stamp }).strict().optional(),
  editorialPortrait: z.object({ src: z.string().regex(PORTRAIT_FILE), alt: text.max(700), artworkId: safeId, sourceUrl: webUrl, sourceTitle: text, checkedAt: stamp }).strict().optional(),
}).strict().superRefine((person, context) => {
  const accounts = person.accounts.map(account => `${account.platform}:${account.handle.toLowerCase()}`);
  const memberships = person.memberships.map(member => `${member.competitionId}:${member.teamId}:${member.memberHandle}`);
  if (new Set(accounts).size !== accounts.length || new Set(memberships).size !== memberships.length || person.memberships.some(member => !person.accounts.some(account => account.platform === 'kaggle' && account.handle === member.memberHandle))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate identity or membership without a verified account' });
  }
  // A face must trace to the person's own Kaggle account, one of their Hall of Fame cards, or (Boss,
  // 30-Oct-2026) a public web page that names them: an official team page, a publisher's author page.
  const portrait = person.portrait;
  const plain = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const traced = !portrait || (portrait.kind === 'kaggle'
    ? person.accounts.some(account => account.platform === 'kaggle' && account.url.toLowerCase() === portrait.sourceUrl.toLowerCase())
    : portrait.kind === 'web'
      ? plain(`${portrait.sourceTitle} ${portrait.alt}`).includes(plain(person.name))
      : person.hallOfFame.some(card => `${HALL_OF_FAME_ORIGIN}${card.path}` === portrait.sourceUrl));
  if (!traced) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Portrait must come from the person’s Kaggle account, their own Hall of Fame card, or a public page that names them' });
  }
  const editorial = person.editorialPortrait;
  if (editorial && !person.accounts.some(account => account.platform === 'kaggle' && account.url.toLowerCase() === editorial.sourceUrl.toLowerCase())
    && !person.hallOfFame.some(card => `${HALL_OF_FAME_ORIGIN}${card.path}` === editorial.sourceUrl)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Editorial portrait reference must belong to this verified person' });
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
  return fs.readdirSync(root).filter(file => file.endsWith('.json')).flatMap(file => readStoryFile(directory, folder, file, schema, skipped));
}
/** One story file, checked like every file in its folder; an invalid file is left out and reported. */
function readStoryFile<T extends { id: string }>(directory: string, folder: string, file: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>, skipped: NewsSkip[]): T[] {
  const label = `${folder}/${file}`;
  try {
    const parsed = schema.safeParse(JSON.parse(fs.readFileSync(path.join(directory, folder, file), 'utf8')));
    if (!parsed.success) leaveOut(skipped, { file: label, reason: describeIssues(parsed.error) });
    else if (`${parsed.data.id}.json` !== file) leaveOut(skipped, { file: label, reason: 'filename does not match its ID' });
    else return [parsed.data];
  } catch (error) {
    leaveOut(skipped, { file: label, reason: `unreadable: ${describeError(error)}` });
  }
  return [];
}
/**
 * One wire story by ID for its permanent page (/news/wire/<id>), whatever its age: the index keeps
 * only a week. `rejected` means the file exists but failed its checks, a loading problem rather
 * than an unpublished story.
 */
export function loadWireStory(id: string, directory = NEWS_DIRECTORY): { story: NewsWireStory | null; rejected: boolean } {
  if (!WIRE_ID.test(id) || !fs.existsSync(path.join(directory, 'wire', `${id}.json`))) return { story: null, rejected: false };
  const story = readStoryFile(directory, 'wire', `${id}.json`, newsWireSchema, [])[0] ?? null;
  return { story, rejected: !story };
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
/**
 * A dated revision of a published story. The records come in several historical shapes: an edition correction
 * names `articleId`, a feature revision keeps the `original` story, and the revision evidence keeps the
 * `previousArticle` or `previousFeature`. The time is `revisedAt`, else the record's `date`, else the date its
 * filename starts with. A record that names no story (the special-page corrections) is not a story revision.
 */
const revisionRecordSchema = z.object({
  articleId: safeId.optional(),
  original: z.object({ id: safeId }).passthrough().optional(),
  previousArticle: z.object({ id: safeId }).passthrough().optional(),
  previousFeature: z.object({ id: safeId }).passthrough().optional(),
  revisedAt: stamp.optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reason: text.max(2000).optional(),
}).passthrough();
/** Correction records, plus the editorial and reporting revision evidence (illustration swaps are not revisions of the reporting). */
const REVISION_FOLDERS: [string, RegExp][] = [['corrections', /\.json$/], ['evidence', /-(?:editorial|reporting)-revision-[a-z0-9-]+\.json$/]];
function readRevisions(directory: string, skipped: NewsSkip[]): Map<string, NewsRevision[]> {
  const byStory = new Map<string, NewsRevision[]>();
  for (const [folder, pattern] of REVISION_FOLDERS) {
    const root = path.join(directory, folder);
    if (!fs.existsSync(root)) continue;
    for (const file of fs.readdirSync(root).filter(name => pattern.test(name))) {
      try {
        const parsed = revisionRecordSchema.safeParse(JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')));
        if (!parsed.success) { leaveOut(skipped, { file: `${folder}/${file}`, reason: describeIssues(parsed.error) }); continue; }
        const record = parsed.data;
        const storyId = record.articleId ?? record.original?.id ?? record.previousArticle?.id ?? record.previousFeature?.id;
        const at = record.revisedAt ?? record.date ?? /^\d{4}-\d{2}-\d{2}/.exec(file)?.[0];
        if (!storyId || !at) continue;
        byStory.set(storyId, [...(byStory.get(storyId) ?? []), { at, ...(record.reason ? { reason: record.reason } : {}) }]);
      } catch (error) {
        leaveOut(skipped, { file: `${folder}/${file}`, reason: `unreadable: ${describeError(error)}` });
      }
    }
  }
  // A date-only record sorts as the end of its day, after any timed revision on the same day.
  const instant = (value: string) => Date.parse(value.length === 10 ? `${value}T23:59:59Z` : value);
  for (const revisions of byStory.values()) revisions.sort((a, b) => instant(a.at) - instant(b.at));
  return byStory;
}
/** Attach a story's revisions, oldest first, and the latest as updatedAt. */
const withRevisions = <T extends { id: string }>(story: T, revisions: Map<string, NewsRevision[]>): T & { revisions?: NewsRevision[]; updatedAt?: string } => {
  const found = revisions.get(story.id);
  return found?.length ? { ...story, revisions: found, updatedAt: found[found.length - 1].at } : story;
};
/** The public archive plus anything that had to be left out of it. */
export function loadNewsArchive(directory = NEWS_DIRECTORY): { index: NewsIndex; skipped: NewsSkip[] } {
  const skipped: NewsSkip[] = [];
  let wiki: ReturnType<typeof loadWikiInputs> = null;
  try { wiki = loadWikiInputs(directory); }
  catch (error) { leaveOut(skipped, { file: 'goose-wiki.json', reason: String(error) }); }
  const wikiRows = <T,>(rows: unknown[], validator: z.ZodType<T>): T[] => rows.flatMap((row, position) => {
    const parsed = validator.safeParse(row);
    if (parsed.success) return [parsed.data];
    leaveOut(skipped, { file: 'goose-wiki.json', record: String(position), reason: parsed.error.message });
    return [];
  });
  // Historical display corrections are separate from the immutable issue and its release proof.
  const archiveCasts = new Map(readLedger(directory, 'archive-casts.json', archiveCastSchema, row => row.id, skipped)
    .map(row => [row.id, row.personIds]));
  const applyArchiveCast = <T extends { id: string; personIds?: string[] }>(story: T): T =>
    story.personIds === undefined && archiveCasts.has(story.id) ? { ...story, personIds: archiveCasts.get(story.id) } : story;
  const revisions = readRevisions(directory, skipped);
  const articles: NewsArticle[] = readStoryFolder(directory, 'articles', newsArticleSchema, skipped)
    .map(article => withRevisions(applyArchiveCast(article), revisions))
    .filter(article => {
      const issue = articleTimeOrderIssue(article, article.revisions);
      if (issue) leaveOut(skipped, { file: `articles/${article.id}.json`, reason: issue });
      return !issue;
    })
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.competition.localeCompare(b.competition));
  const competitors: CompetitorRecord[] = mergeCompetitorRows(readLedger(directory, 'competitors.json', competitorSchema, record => record.id, skipped), wikiRows(wiki?.competitors ?? [], competitorSchema));
  const dispatches: NewsDispatch[] = readStoryFolder(directory, 'dispatches', newsDispatchSchema, skipped)
    .map(dispatch => withRevisions(applyArchiveCast(dispatch), revisions))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id.localeCompare(a.id));
  // A verified account names one person; a later record claiming an earlier person's account is left out whole.
  const claimed = new Set<string>();
  const people = mergeWikiRows(readLedger(directory, 'people.json', newsPersonSchema, person => person.id, skipped), wikiRows(wiki?.people ?? [], newsPersonSchema)).filter(person => {
    const accounts = person.accounts.map(account => `${account.platform}:${account.handle.toLowerCase()}`);
    const taken = accounts.find(account => claimed.has(account));
    if (taken) {
      leaveOut(skipped, { file: 'people.json', record: person.id, reason: `verified account ${taken} already belongs to another person` });
      return false;
    }
    accounts.forEach(account => claimed.add(account));
    return true;
  });
  // The From X strip is current reporting, so it keeps the same one-week window as discussions and the wire.
  // When the edition desk stops exporting (as it did from 22-Oct-2026), the strip empties and hides itself
  // instead of presenting weeks-old posts as the latest. social.json stays in git unchanged.
  const social = readLedger(directory, 'social.json', newsSocialSchema, post => post.id, skipped)
    .filter(post => Date.now() - Date.parse(post.postedAt ?? post.checkedAt) <= WIRE_WINDOW_MS);
  const discussions = readLedger(directory, 'discussions.json', newsDiscussionSchema, thread => `${thread.competition}:${thread.id}`, skipped)
    .filter(thread => Date.now() - Date.parse(thread.latestActivityAt ?? thread.postedAt!) <= WIRE_WINDOW_MS);
  // The index the front page refetches every minute carries the past week of wire, at most 40 stories;
  // the files stay in git as the permanent record and keep their evidence route.
  const filed: NewsWireStory[] = readStoryFolder(directory, 'wire', newsWireSchema, skipped)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id.localeCompare(a.id));
  const wire = filed.filter(story => Date.now() - Date.parse(story.publishedAt) <= WIRE_WINDOW_MS).slice(0, WIRE_LIMIT);
  // A desk silent for over a week still has a record: its newest filings let the wire page date the pause.
  const wireLatest = wire.length ? [] : filed.slice(0, WIRE_PAUSED_LIMIT);
  return { index: { articles, competitors, dispatches, people, social, discussions, wire, ...(wireLatest.length ? { wireLatest } : {}) }, skipped };
}
export function getNewsIndex(directory = NEWS_DIRECTORY): NewsIndex {
  return loadNewsArchive(directory).index;
}
