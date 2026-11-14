/**
 * Author: GPT-6 / Codex (reasoning effort not exposed); Claude Opus 5.5
 * Date: 14-Nov-2026
 * 14-Nov-2026 (Claude Opus 5.5): each board is built in its own try/catch (a failed query or a corrupt
 *          saved body leaves only that board out), a failed rebuild serves the last good digest, and
 *          concurrent readers after expiry share one in-flight rebuild.
 * PURPOSE: Serves the ARC Daily Digest's market digest (GET /api/news/markets): one compact
 *          summary per Kaggle board for the front page's ticker, standings and movers, and the
 *          evidence the wire desk's reporters write from. Reads the board documents the Mac Mini
 *          pushes every half hour (KaggleBoardRepository), adds the notebook, ledger and featured
 *          teams as watched rows, and keeps the JSON and its gzip for a minute. A board that was
 *          never pushed, a database that is down, a failed query or a corrupt saved document
 *          leaves that board out; if the whole rebuild fails, the last good digest is served.
 * SRP/DRY check: Pass — the digest itself is shared/newsMarkets.ts; the cache-and-gzip pattern
 *          matches the board route in server/routes/kaggle.ts.
 */
import { gzipSync } from 'node:zlib';
import { KAGGLE_COMPETITIONS } from '../../../shared/kaggleCompetitions';
import type { NewsCompetition, NewsIndex } from '../../../shared/news';
import { buildMarketBoard, type MarketBoard, type MarketsPayload } from '../../../shared/newsMarkets';
import type { KaggleBoardEvent, KaggleBoardHistory, KaggleBoardLatest } from '../../../shared/types';
import { kaggleBoardRepository } from '../../repositories/KaggleBoardRepository.js';
import { logger } from '../../utils/logger';
import { getNewsIndex } from './newsStore';

const TTL_MS = 60_000;
type MarketsEntry = { at: number; payload: MarketsPayload; raw: Buffer; gzip: Buffer };
let cached: MarketsEntry | null = null;
/** The rebuild in progress, shared by every reader that arrives while it runs. */
let rebuilding: Promise<MarketsEntry> | null = null;

const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);

/** Teams the paper follows on a board: notebook dossiers, ledger memberships and featured teams. */
function watchedTeams(index: NewsIndex, competition: NewsCompetition): Set<string> {
  return new Set([
    ...index.competitors.filter(record => record.competition === competition).map(record => record.teamId),
    ...(index.people ?? []).flatMap(person => person.memberships.filter(member => member.competition === competition).map(member => member.teamId)),
  ]);
}

/** One competition's digest, or null when its board was never pushed. Throws on a query or parse failure. */
async function marketBoard(index: NewsIndex, competition: NewsCompetition): Promise<MarketBoard | null> {
  const docs = await kaggleBoardRepository.getDocuments(KAGGLE_COMPETITIONS[competition].slug, ['latest', 'history', 'events']);
  const parsed = (name: string) => {
    const body = docs.find(doc => doc.name === name)?.body;
    return body ? JSON.parse(body) : null;
  };
  const latest = parsed('latest') as KaggleBoardLatest | null;
  if (!latest?.rows?.length) return null;
  return buildMarketBoard(competition, latest, parsed('history') as KaggleBoardHistory | null,
    parsed('events') as KaggleBoardEvent[] | null, watchedTeams(index, competition));
}

export async function buildMarkets(now = new Date()): Promise<MarketsPayload> {
  const index = getNewsIndex();
  const boards: MarketsPayload['boards'] = {};
  for (const competition of ['arc-3', 'arc-2'] as const) {
    // One bad board (query error, corrupt saved JSON) must not take the other one down with it.
    try {
      const board = await marketBoard(index, competition);
      if (board) boards[competition] = board;
    } catch (error) {
      logger.warn(`news markets: left the ${competition} board out - ${errorText(error)}`, 'news');
    }
  }
  return { generatedAt: now.toISOString(), boards };
}

async function rebuild(): Promise<MarketsEntry> {
  const payload = await buildMarkets();
  const raw = Buffer.from(JSON.stringify(payload), 'utf8');
  return { at: Date.now(), payload, raw, gzip: gzipSync(raw) };
}

/** The digest, rebuilt at most once a minute and shared by every reader below; stale beats a 500. */
async function current(): Promise<MarketsEntry> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached;
  rebuilding ??= rebuild().then(entry => (cached = entry)).finally(() => { rebuilding = null; });
  try {
    return await rebuilding;
  } catch (error) {
    if (!cached) throw error;
    logger.warn(`news markets: rebuild failed, serving the digest from ${new Date(cached.at).toISOString()} - ${errorText(error)}`, 'news');
    return cached;
  }
}

/** The digest as JSON and gzip, rebuilt at most once a minute. */
export async function marketsResponse(): Promise<{ raw: Buffer; gzip: Buffer }> {
  return current();
}

/** The digest as an object, for server-rendered crawler text (server/services/seo/leaderboardSeo.ts). */
export async function latestMarkets(): Promise<MarketsPayload> {
  return (await current()).payload;
}
