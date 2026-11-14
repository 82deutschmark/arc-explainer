/**
 * Author: GPT-6 / Codex (reasoning effort not exposed); Claude Opus 5.5
 * Date: 14-Nov-2026 (Claude Opus 5.5); 02-November-2026
 * 09-Nov-2026 (GPT-6 / Codex): contest card evidence and regression checks.
 * 14-Nov-2026 (Claude Opus 5.5): boardFreshAt now lives in shared/newsMarkets.ts (re-exported here) so the
 * newspaper's ticker and movers share the rule.
 * 14-Nov-2026 (Claude Opus 5.5, archive-collection): a duplicated team row drops only that team, not the whole contest;
 * the generation moves only when the decoded rows change (so the Card Cabinet memo is not rebuilt every minute); a
 * failed board read names the contest and the reason, and cardBoardStatus exposes it to /api/news/health.
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
const REASON_LIMIT = 200;               // a board failure reaches the public health endpoint; keep it one short line

// The freshness rule lives with the market digest so the newspaper's board labels use the same one.
export { boardFreshAt };

/** Decode only the requested competition and teams; a team listed twice is ambiguous and left without a standing. */
export function snapshotsFromBoard(competition: string, latest: any, teams: Set<string>, now = Date.now()): CardSnapshot[] {
  const info = KAGGLE_COMPETITIONS[competition];
  if (!info || info.format === 'judged' || latest?.competition !== info.slug || !boardFreshAt(latest.fetched, info.closeAt, now) || !Array.isArray(latest.rows)) return [];
  const seen = new Set<string>();
  const conflicting = new Set<string>();
  const rows: CardSnapshot[] = [];
  for (const row of latest.rows) {
    if (!Array.isArray(row) || !teams.has(String(row[1]))) continue;
    const teamId = String(row[1]);
    // Conflicting rows cannot establish that team's standing; every other team on the board is unaffected.
    if (seen.has(teamId)) { conflicting.add(teamId); continue; }
    seen.add(teamId);
    const parsed = cardSnapshotSchema.safeParse({ competition, competitionId: info.slug,
      teamId, observedAt: latest.fetched, teamName: row[2], rank: row[0], score: row[4], submissions: row[5],
      members: typeof row[6] === 'string' ? row[6].split(',').map((s: string) => s.trim()).filter(Boolean) : [],
      sourceUrl: `https://www.kaggle.com/competitions/${info.slug}/leaderboard?teamId=${encodeURIComponent(row[1])}` });
    if (parsed.success) rows.push(parsed.data);
  }
  return rows.filter(row => !conflicting.has(row.teamId));
}

const reasonOf = (reason: unknown) => (reason instanceof Error ? reason.message : String(reason)).replace(/\s+/g, ' ').slice(0, REASON_LIMIT);

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
    const rows = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
    // The generation stamps the Card Cabinet memo: move it only when the standings actually changed.
    if (JSON.stringify(rows) !== JSON.stringify(current.rows)) {
      current.rows = rows;
      current.generation++;
    }
    const failures = results.flatMap((result, position) => result.status === 'rejected' ? [`${competitions[position]}: ${reasonOf(result.reason)}`] : []);
    current.error = failures.length ? `Contest board unavailable (${failures.join('; ')}); cards link to the Kaggle board instead.` : undefined;
  })
    .finally(() => { current.pending = undefined; });
  return current;
}

/** The board generation and last read error for a directory, without starting a read (memo checks and health). */
export function cardBoardStatus(directory: string): { generation: number | null; error?: string } {
  const cache = caches.get(directory);
  return cache ? { generation: cache.generation, ...(cache.error ? { error: cache.error } : {}) } : { generation: null };
}

export function freshCardRows(cache: Cache): CardSnapshot[] {
  return cache.rows.filter(row => boardFreshAt(row.observedAt, KAGGLE_COMPETITIONS[row.competition]?.closeAt ?? null));
}
