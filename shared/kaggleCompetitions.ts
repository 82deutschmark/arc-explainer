/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-08
 * PURPOSE: Competition identities and presentation settings shared by the public Kaggle
 *          pages and server metadata. Team IDs belong to a single competition; names and
 *          standings always come from its latest board. Unknown close times stay absent.
 * SRP/DRY check: Pass — one registry prevents chart dates, links and featured teams drifting.
 */
export interface KaggleCompetition {
  slug: string;
  label: string;
  path: string;
  closeAt: string | null;
  scoreLabel: string;
  featuredTeamIds: string[];
  pinnedTeamIds: string[];
  backfillSource: string | null;
}

export const KAGGLE_COMPETITIONS = {
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

export type KaggleCompetitionKey = keyof typeof KAGGLE_COMPETITIONS;
export const kaggleLeaderboardUrl = (competition: KaggleCompetition) => `https://www.kaggle.com/competitions/${competition.slug}/leaderboard`;
