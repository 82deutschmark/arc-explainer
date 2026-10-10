/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-09; 10-October-2026 (Claude Sonnet 5.5: latestMarkets, the same cached digest as an object)
 * PURPOSE: Serves the ARC Daily Digest's market digest (GET /api/news/markets): one compact
 *          summary per Kaggle board for the front page's ticker, standings and movers, and the
 *          evidence the wire desk's reporters write from. Reads the board documents the Mac Mini
 *          pushes every half hour (KaggleBoardRepository), adds the notebook, ledger and featured
 *          teams as watched rows, and keeps the JSON and its gzip for a minute. A board that was
 *          never pushed, or a database that is down, simply leaves that board out.
 * SRP/DRY check: Pass — the digest itself is shared/newsMarkets.ts; the cache-and-gzip pattern
 *          matches the board route in server/routes/kaggle.ts.
 */
import { gzipSync } from 'node:zlib';
import { KAGGLE_COMPETITIONS } from '../../../shared/kaggleCompetitions';
import type { NewsCompetition, NewsIndex } from '../../../shared/news';
import { buildMarketBoard, type MarketsPayload } from '../../../shared/newsMarkets';
import type { KaggleBoardEvent, KaggleBoardHistory, KaggleBoardLatest } from '../../../shared/types';
import { kaggleBoardRepository } from '../../repositories/KaggleBoardRepository.js';
import { getNewsIndex } from './newsStore';

const TTL_MS = 60_000;
let cached: { at: number; payload: MarketsPayload; raw: Buffer; gzip: Buffer } | null = null;

/** Teams the paper follows on a board: notebook dossiers, ledger memberships and featured teams. */
function watchedTeams(index: NewsIndex, competition: NewsCompetition): Set<string> {
  return new Set([
    ...KAGGLE_COMPETITIONS[competition].featuredTeamIds,
    ...index.competitors.filter(record => record.competition === competition).map(record => record.teamId),
    ...(index.people ?? []).flatMap(person => person.memberships.filter(member => member.competition === competition).map(member => member.teamId)),
  ]);
}

export async function buildMarkets(now = new Date()): Promise<MarketsPayload> {
  const index = getNewsIndex();
  const boards: MarketsPayload['boards'] = {};
  for (const competition of ['arc-3', 'arc-2'] as const) {
    const docs = await kaggleBoardRepository.getDocuments(KAGGLE_COMPETITIONS[competition].slug, ['latest', 'history', 'events']);
    const parsed = (name: string) => {
      const body = docs.find(doc => doc.name === name)?.body;
      return body ? JSON.parse(body) : null;
    };
    const latest = parsed('latest') as KaggleBoardLatest | null;
    if (!latest?.rows?.length) continue;
    const board = buildMarketBoard(competition, latest, parsed('history') as KaggleBoardHistory | null,
      parsed('events') as KaggleBoardEvent[] | null, watchedTeams(index, competition));
    if (board) boards[competition] = board;
  }
  return { generatedAt: now.toISOString(), boards };
}

/** The digest, rebuilt at most once a minute and shared by every reader below. */
async function current() {
  if (cached && Date.now() - cached.at < TTL_MS) return cached;
  const payload = await buildMarkets();
  const raw = Buffer.from(JSON.stringify(payload), 'utf8');
  cached = { at: Date.now(), payload, raw, gzip: gzipSync(raw) };
  return cached;
}

/** The digest as JSON and gzip, rebuilt at most once a minute. */
export async function marketsResponse(): Promise<{ raw: Buffer; gzip: Buffer }> {
  return current();
}

/** The digest as an object, for server-rendered crawler text (server/services/seo/leaderboardSeo.ts). */
export async function latestMarkets(): Promise<MarketsPayload> {
  return (await current()).payload;
}
