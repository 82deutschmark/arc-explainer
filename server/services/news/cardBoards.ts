/**
 * Author: GPT-6 / Codex (reasoning effort not exposed); Claude Opus 5.5
 * Date: 14-Nov-2026 (Claude Opus 5.5); 02-November-2026
 * 09-Nov-2026 (GPT-6 / Codex): contest card evidence and regression checks.
 * 14-Nov-2026 (Claude Opus 5.5): boardFreshAt now lives in shared/newsMarkets.ts (re-exported here) so the
 * newspaper's ticker and movers share the rule.
 * PURPOSE: Warm a bounded in-memory view of the existing board data store for
 * wiki-backed cards. Standings never enter the wiki; unavailable/stale readings
 * leave cards with source links. No Kaggle login, collector or scheduled job.
 * SRP/DRY check: Pass — reuse KaggleBoardRepository and the existing snapshot schema.
 */
import { KAGGLE_COMPETITIONS } from '../../../shared/kaggleCompetitions';
import { boardFreshAt } from '../../../shared/newsMarkets';
import { cardSnapshotSchema, type CardSnapshot, type CardRegistry } from '../../../shared/newsCollection';
import type { NewsIndex } from '../../../shared/news';
import { kaggleBoardRepository } from '../../repositories/KaggleBoardRepository';

type Cache = { generation: number; checkedAt: number; pending?: Promise<void>; rows: CardSnapshot[]; error?: string };
const caches = new Map<string, Cache>();
const TTL = 60_000;

// The freshness rule lives with the market digest so the newspaper's board labels use the same one.
export { boardFreshAt };

/** Decode only the requested competition and teams; ambiguous rows stay unavailable. */
export function snapshotsFromBoard(competition: string, latest: any, teams: Set<string>, now = Date.now()): CardSnapshot[] {
  const info = KAGGLE_COMPETITIONS[competition];
  if (!info || info.format === 'judged' || latest?.competition !== info.slug || !boardFreshAt(latest.fetched, info.closeAt, now) || !Array.isArray(latest.rows)) return [];
  const seen = new Set<string>();
  const rows: CardSnapshot[] = [];
  for (const row of latest.rows) {
    if (!Array.isArray(row) || !teams.has(String(row[1]))) continue;
    if (seen.has(String(row[1]))) return []; // Conflicting team rows cannot establish a standing.
    seen.add(String(row[1]));
    const parsed = cardSnapshotSchema.safeParse({ competition, competitionId: info.slug,
      teamId: String(row[1]), observedAt: latest.fetched, teamName: row[2], rank: row[0], score: row[4], submissions: row[5],
      members: typeof row[6] === 'string' ? row[6].split(',').map((s: string) => s.trim()).filter(Boolean) : [],
      sourceUrl: `https://www.kaggle.com/competitions/${info.slug}/leaderboard?teamId=${encodeURIComponent(row[1])}` });
    if (parsed.success) rows.push(parsed.data);
  }
  return rows;
}

export function cardBoardCache(directory: string, registry: CardRegistry, index: NewsIndex): Cache {
  let cache = caches.get(directory);
  if (!cache) caches.set(directory, cache = { generation: 0, checkedAt: 0, rows: [] });
  if (cache.pending || Date.now() - cache.checkedAt < TTL) return cache;
  cache.checkedAt = Date.now();
  const refs = [...registry.cards.flatMap(card => card.entries), ...(index.people ?? []).flatMap(person => person.memberships)];
  const competitions = [...new Set(refs.map(row => row.competition))];
  const current = cache;
  // Warm once for every data-store generation; image requests can reuse the same
  // synchronous collection. Missing database rows are an honest unavailable state.
  current.pending = Promise.allSettled(competitions.map(async competition => {
    const info = KAGGLE_COMPETITIONS[competition];
    if (!info || info.format === 'judged') return [];
    const docs = await kaggleBoardRepository.getDocuments(info.slug, ['latest']);
    const body = docs.find(doc => doc.name === 'latest')?.body;
    if (!body) return [];
    const latest = JSON.parse(body);
    return snapshotsFromBoard(competition, latest,
      new Set(refs.filter(row => row.competition === competition).map(row => row.teamId)));
  })).then(results => {
    current.rows = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
    current.generation++;
    current.error = results.some(result => result.status === 'rejected') ? 'A contest board is unavailable; use its linked Kaggle board.' : undefined;
  })
    .finally(() => { current.pending = undefined; });
  return current;
}

export function freshCardRows(cache: Cache): CardSnapshot[] {
  return cache.rows.filter(row => boardFreshAt(row.observedAt, KAGGLE_COMPETITIONS[row.competition]?.closeAt ?? null));
}
