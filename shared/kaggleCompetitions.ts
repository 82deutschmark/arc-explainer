/**
 * Author: GPT-6 / Codex (reasoning effort not exposed)
 * Date: 02-November-2026
 * PURPOSE: Competition identities and presentation settings shared by the public Kaggle
 *          pages and server metadata. Team IDs belong to a single competition; names and
 *          standings always come from its latest board. Unknown close times stay absent.
 *          16-Oct-2026 (Claude Opus 5.5 Medium): closeMs/daysToClose are the one countdown
 *          source; the front page's clock, the newspaper masthead and the board tiles read them.
 * SRP/DRY check: Pass — one registry prevents chart dates, links and featured teams drifting.
 */
import directory from './gooseDirectory.json';
export interface KaggleCompetition {
  slug: string;
  label: string;
  path: string;
  closeAt: string | null;
  scoreLabel: string;
  featuredTeamIds: string[];
  pinnedTeamIds: string[];
  backfillSource: string | null;
  wikiId?: string;
  format?: string;
  officialHosts?: string[];
  season?: string | null;
}

// These are the existing board routes' historical settings. They do not select
// Goose coverage; every wiki competition below receives the same publishing path.
const LEGACY_BOARDS = {
  'arc-3': {
    slug: 'arc-prize-2026-arc-agi-3',
    label: 'ARC-AGI-3',
    path: '/kaggle-leaderboard',
    closeAt: '2026-11-02T23:59:00Z',
    scoreLabel: 'Score (points)',
    featuredTeamIds: ['15770880', '16032816', '15501006', '16371045', '16021367', '15508513'],
    pinnedTeamIds: ['15605182'],
    backfillSource: 'arc3.huikang.dev',
  },
  'arc-2': {
    slug: 'arc-prize-2026-arc-agi-2',
    label: 'ARC-AGI-2',
    path: '/kaggle-leaderboard/arc-2',
    closeAt: '2026-11-02T23:59:00Z',
    scoreLabel: 'Score (points)',
    featuredTeamIds: ['15486939', '15507730', '17023174', '15605185', '15487968', '15486728', '15526034'],
    pinnedTeamIds: ['17023174', '15605185'],
    backfillSource: null,
  },
} satisfies Record<string, KaggleCompetition>;

export const KAGGLE_COMPETITIONS: Record<string, KaggleCompetition> = {
  ...LEGACY_BOARDS,
  ...Object.fromEntries(Object.entries(directory.competitions).map(([key, row]) => {
    const old = (LEGACY_BOARDS as Record<string, KaggleCompetition>)[key];
    return [key, { slug: row.slug, label: old?.label ?? row.label,
      path: old?.path ?? `${row.url}${row.format === 'judged' || !row.url.includes('kaggle.com/competitions/') ? '' : '/leaderboard'}`,
      closeAt: row.closeAt, scoreLabel: 'Official score', featuredTeamIds: old?.featuredTeamIds ?? [],
      pinnedTeamIds: old?.pinnedTeamIds ?? [], backfillSource: old?.backfillSource ?? null,
      wikiId: row.wikiId, format: row.format, officialHosts: row.officialHosts, season: row.season }];
  })),
};
export type KaggleCompetitionKey = string;
export const competitionRegistered = (key: string) => Object.hasOwn(KAGGLE_COMPETITIONS, key);
export const kaggleLeaderboardUrl = (competition: KaggleCompetition) => `https://www.kaggle.com/competitions/${competition.slug}/leaderboard`;

/** The close as epoch milliseconds, or null while Kaggle has not published one. */
export const closeMs = (competition: KaggleCompetition): number | null =>
  competition.closeAt ? Date.parse(competition.closeAt) : null;

/** Whole days left before the close, rounded up, never below zero; null when the close is unknown.
 *  Counts from now. shared/newsMarkets.ts has its own daysToClose that counts from a board save,
 *  on purpose: a printed market table must agree with the save it shows. */
export function daysToClose(competition: KaggleCompetition, now = Date.now()): number | null {
  const close = closeMs(competition);
  return close == null ? null : Math.max(0, Math.ceil((close - now) / 86_400_000));
}
