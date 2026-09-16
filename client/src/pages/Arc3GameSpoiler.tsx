/*
 * Author: Cascade (ChatGPT); updated by Claude Opus 5, 2026-09-12; updated by Claude Sonnet 5, 2026-09-12
 * Date: 2026-02-10 (last updated 2026-09-12)
 * PURPOSE: Individual game spoiler page for ARC-AGI-3 games.
 *          Displays all known information on a single page: game mechanics (centerpiece),
 *          action mappings, level screenshots, and external resources.
 *          Optimized for developer comprehension and LLM parsing (no interactive tabs).
 *          2026-09-12: the two "Test with Agent" buttons are gone -- this site does not
 *          run agents against games any more -- and are replaced by a single Play button
 *          into the blind play surface. The play id is NOT the spoiler-page id: the mirror
 *          publishes the official games under a versioned id (`sc25` -> `sc25-635fd71a`),
 *          so it is resolved at render time from /api/arc3-mirror/games. When the catalog
 *          has no match the button is not rendered at all, because linking a player into a
 *          task the mirror cannot serve is the exact failure CommunityGamePlay documents.
 *          2026-09-12 PM: added the "In Plain English" card, right under the hero -- every
 *          game in shared/arc3Games now carries a required `simpleExplanation`, one or two
 *          plain sentences with the source citations and precise field names stripped out.
 *          2026-09-12 PM (later): moved Level Screenshots up to lead the page, right after
 *          In Plain English -- pictures of the game before Human Records, replays, and the
 *          full mechanics write-up, not buried under them. No content changed, just order.
 *          2026-09-16 (Claude Opus 5): action counts up top and two human ratings.
 *          - A stat strip under the description on every game page: ARC's baseline actions
 *            and Boss's actions (both from humanPlay.generated.json via getOwnerGameRating),
 *            and the fewest and median actions among recent top-10 wins (from the
 *            leaderboard route). The leaderboard query is now made once, in the page, and
 *            passed to the strip, the badge and HumanRecordsCard.
 *          - The single Human badge is now "Human (top 10)" (top10Difficulty over the
 *            board's recent-wins stats, computed here, not the stale per-game
 *            humanDifficulty field) and "Human (Boss)" (getOwnerGameRating). AI badge unchanged.
 *          - HumanRecordsCard shows score spread, fewest/median/most actions over recent
 *            wins, how many rows survived the 18 Jun 2026 cut, and greys out older rows.
 *          - New "Every Mechanic" card after In Plain English renders mechanicsBreakdown,
 *            grouped by the level that introduces each point. Renders nothing when absent.
 *          - Later the same day: "Notes From Play" card after it renders playerObservations
 *            (what a human saw, did, expected, and what happened).
 * SRP/DRY check: Pass - Single responsibility (game detail display), reuses shared game metadata.
 *          All rating math lives in shared/arc3Games/humanDifficulty.ts; this file only
 *          formats its results. No new fetches: the one leaderboard query is shared.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'wouter';
import {
  Gamepad2,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Eye,
  Lock,
  Unlock,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  Keyboard,
  Link2,
  Play,
  Trophy,
  Download,
  User,
  Bot,
  ListChecks,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePageMeta } from '@/hooks/usePageMeta';
import {
  arcPrizeLeaderboardUrl,
  getGameById,
  getAdjacentGameIds,
  type Arc3GameMetadata,
  type DifficultyRating,
  type ActionMapping,
  type LevelScreenshot,
  type GameResource,
  type MechanicPoint,
  type PlayerObservation,
} from '../../../shared/arc3Games';
import {
  getOwnerGameRating,
  getPlayerRuns,
  top10Difficulty,
  HUMAN_DATA_CUTOFF,
  OWNER_PLAYER,
  OWNER_EASY_AT_OR_BELOW,
  OWNER_HARD_AT,
  OWNER_VERY_HARD_AT,
  OWNER_MIN_WON_GAMES,
  TOP10_MIN_RECENT_WINS,
  TOP10_EASY_BELOW,
  TOP10_HARD_AT,
  type OwnerGameRating,
  type Top10Stats,
} from '../../../shared/arc3Games/humanDifficulty';

/** Mirrors HumanLeaderboardEntry in server/services/arc3/arcPrizeLeaderboardService.ts. */
interface HumanLeaderboardEntry {
  userName: string;
  score: number;
  actions: number;
  resets: number;
  endState: string;
  publishedAt: string | null;
  /** Published on or after HUMAN_DATA_CUTOFF. False = an old row: greyed out, not in `stats`. */
  recent: boolean;
}

/** Mirrors HumanLeaderboard in server/services/arc3/arcPrizeLeaderboardService.ts. */
interface HumanLeaderboard {
  gameId: string;
  /** Every row the board returned, best first, old rows included. */
  entries: HumanLeaderboardEntry[];
  /** Fewest actions among recent wins. Same number as stats.fewestActions. */
  fewestActions: number | null;
  recentCutoff: string;
  /** Computed on the server from recent winning rows only. */
  stats: Top10Stats;
  fetchedAt: string;
}

/** A calendar day in UTC ("18 Jun 2026"), the same way the cutoff is defined. */
function formatDay(iso: string | null): string {
  if (!iso) return 'no date';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return 'no date';
  return at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

const CUTOFF_DAY = formatDay(HUMAN_DATA_CUTOFF);

function plural(count: number, one: string, many: string = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * What people actually did on this game, from the official ARC Prize human leaderboard.
 *
 * The interesting number is the ACTION COUNT, not the score: every row on every board
 * scored 100 when this was written, and what separates players is how many moves they
 * needed. Only rows published on or after the cutoff count toward the numbers; older
 * rows stay in the table, greyed out with their date, so nothing is hidden.
 *
 * Renders nothing at all when the endpoint has nothing for this game -- it is somebody
 * else's service and the write-up must not depend on it being up. The board is fetched
 * once by the page and passed in.
 */
function HumanRecordsCard({ gameId, board }: { gameId: string; board: HumanLeaderboard | undefined }) {
  if (!board || board.entries.length === 0) return null;

  const { stats } = board;
  const hasRecentWins = stats.recentWins > 0;
  const recentNonWins = stats.recentRows - stats.recentWins;

  let scoreLine: string | null = null;
  if (hasRecentWins && stats.scoreMin !== null && stats.scoreMax !== null) {
    if (stats.scoreMin === stats.scoreMax) {
      scoreLine =
        stats.scoreMin === 100
          ? 'Every recent winning score is 100, so score does not separate anyone here. Action counts do.'
          : `Every recent winning score is ${stats.scoreMin}.`;
    } else {
      scoreLine = `Recent winning scores run from ${stats.scoreMin} to ${stats.scoreMax}.`;
    }
  }

  return (
    <Card className="mb-12 border-2 border-amber-300/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-600" />
          Human Records
        </CardTitle>
        <CardDescription>
          From the official ARC Prize human leaderboard. The numbers count only wins published on or
          after {CUTOFF_DAY}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {hasRecentWins ? (
          <div className="flex flex-wrap gap-8">
            <div>
              <div className="text-3xl font-bold tabular-nums">{stats.fewestActions ?? '—'}</div>
              <div className="text-xs text-muted-foreground mt-0.5">fewest actions</div>
            </div>
            <div>
              <div className="text-3xl font-bold tabular-nums">{stats.medianActions ?? '—'}</div>
              <div className="text-xs text-muted-foreground mt-0.5">median actions</div>
            </div>
            <div>
              <div className="text-3xl font-bold tabular-nums">{stats.mostActions ?? '—'}</div>
              <div className="text-xs text-muted-foreground mt-0.5">most actions</div>
            </div>
            <div>
              <div className="text-3xl font-bold tabular-nums text-muted-foreground">{stats.recentWins}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                recent {stats.recentWins === 1 ? 'win' : 'wins'} counted
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm">
            No row on this board is a win published on or after {CUTOFF_DAY}, so there are no recent
            action counts to show.
          </p>
        )}

        <div className="space-y-1 text-sm">
          {scoreLine && <p>{scoreLine}</p>}
          <p className="text-muted-foreground">
            {stats.recentRows} of {stats.totalRows} rows are from the last 90 days (published on or after{' '}
            {CUTOFF_DAY}). Older rows are greyed out below and left out of the top-10 numbers and rating.
            {recentNonWins > 0 &&
              ` ${plural(recentNonWins, 'recent row')} did not end in a win and ${recentNonWins === 1 ? 'is' : 'are'} not counted either.`}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="py-2 pr-4 font-medium">#</th>
                <th className="py-2 pr-4 font-medium">Player</th>
                <th className="py-2 pr-4 font-medium text-right">Score</th>
                <th className="py-2 pr-4 font-medium text-right">Actions</th>
                <th className="py-2 pr-4 font-medium text-right">Resets</th>
                <th className="py-2 font-medium text-right">Published</th>
              </tr>
            </thead>
            <tbody>
              {board.entries.map((entry, index) => (
                <tr
                  key={`${entry.userName}-${index}`}
                  className={`border-b last:border-0 ${entry.recent ? '' : 'text-muted-foreground opacity-60'}`}
                  title={entry.recent ? undefined : `Published before ${CUTOFF_DAY}: not counted`}
                >
                  <td className="py-2 pr-4 text-muted-foreground tabular-nums">{index + 1}</td>
                  <td className="py-2 pr-4">{entry.userName}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{entry.score}</td>
                  <td className={`py-2 pr-4 text-right tabular-nums ${entry.recent ? 'font-semibold' : ''}`}>
                    {entry.actions}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">{entry.resets}</td>
                  <td className="py-2 text-right tabular-nums whitespace-nowrap">
                    {formatDay(entry.publishedAt)}
                    {!entry.recent && <span className="ml-1 text-xs">(old)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <a
          href={arcPrizeLeaderboardUrl(gameId)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-sm text-primary hover:underline"
        >
          Full leaderboard on arcprize.org
          <ExternalLink className="h-3 w-3 ml-1" />
        </a>
      </CardContent>
    </Card>
  );
}

/** One number in the action strip: the number big, what it is small underneath. */
function StatCell({
  value,
  label,
  detail,
  title,
}: {
  value: React.ReactNode;
  label: string;
  detail?: string;
  title: string;
}) {
  return (
    <div className="min-w-0" title={title}>
      <div className="text-3xl font-bold tabular-nums leading-none">{value}</div>
      <div className="text-xs font-medium text-muted-foreground mt-2">{label}</div>
      {detail && <div className="text-xs text-muted-foreground/80 mt-0.5">{detail}</div>}
    </div>
  );
}

/**
 * The action counts, right under the title on every game page: ARC's baseline, the fewest
 * and median actions among recent top-10 wins, and the owner's own count.
 *
 * The baseline and the owner's numbers come from the committed humanPlay data, so they
 * always render. The two top-10 numbers come from the leaderboard route; when that is
 * loading or down, those two cells say so and the rest of the strip still shows.
 */
function ActionCountStrip({
  gameId,
  owner,
  board,
  boardFailed,
}: {
  gameId: string;
  owner: OwnerGameRating;
  board: HumanLeaderboard | undefined;
  boardFailed: boolean;
}) {
  const { baseline, summary } = owner;
  const stats = board?.stats;
  const boardMissingDetail = boardFailed ? 'leaderboard unavailable' : 'loading leaderboard';

  let fewestDetail: string;
  let medianDetail: string;
  if (!stats) {
    fewestDetail = boardMissingDetail;
    medianDetail = boardMissingDetail;
  } else if (stats.recentWins === 0) {
    fewestDetail = `no wins since ${CUTOFF_DAY}`;
    medianDetail = `no wins since ${CUTOFF_DAY}`;
  } else {
    fewestDetail = `best of ${plural(stats.recentWins, 'recent win')}`;
    medianDetail =
      stats.recentWins === 1
        ? 'only 1 recent win'
        : `${stats.fewestActions}–${stats.mostActions} across ${stats.recentWins} recent wins`;
  }

  let ownerValue: React.ReactNode = '—';
  let ownerLabel = `${OWNER_PLAYER}'s actions`;
  let ownerDetail = 'not played yet';
  let ownerTitle = `${OWNER_PLAYER} has no run on the current build of this game opened on or after ${CUTOFF_DAY}.`;
  if (summary?.won && summary.bestWin) {
    const best = summary.bestWin;
    ownerValue = best.actions;
    ownerLabel = `${OWNER_PLAYER}'s best win`;
    ownerDetail =
      summary.failedBeforeFirstWin > 0
        ? `WIN, after ${plural(summary.failedBeforeFirstWin, 'run')} that did not win`
        : 'WIN';
    ownerTitle =
      `${OWNER_PLAYER}'s fewest-action winning run on the current build since ${CUTOFF_DAY}: ` +
      `${best.actions} actions, ${best.levelsCompleted} of ${best.levelCount} levels, played ${formatDay(best.openAt)}.` +
      (summary.failedBeforeFirstWin > 0
        ? ` Before his first win he spent ${summary.failedActionsBeforeFirstWin} actions on ${plural(summary.failedBeforeFirstWin, 'run')} that did not win.`
        : '');
  } else if (summary) {
    const runs = getPlayerRuns(OWNER_PLAYER, gameId);
    const mostLevels = runs.reduce((most, run) => Math.max(most, run.levelsCompleted), 0);
    const levelCount = baseline?.levelCount ?? runs[0]?.levelCount;
    ownerValue = summary.actionsSpent;
    ownerLabel = `${OWNER_PLAYER}'s actions so far`;
    ownerDetail = `not won yet, ${plural(summary.recentRuns, 'run')}`;
    ownerTitle =
      `${OWNER_PLAYER} has not won this game on the current build since ${CUTOFF_DAY}. ` +
      `${summary.actionsSpent} actions over ${plural(summary.recentRuns, 'run')} so far` +
      (levelCount ? `; his furthest run cleared ${mostLevels} of ${levelCount} levels.` : '.');
  }

  return (
    <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-5 rounded-lg border bg-muted/30 px-5 py-4">
      <StatCell
        value={baseline?.baselineTotal ?? '—'}
        label="ARC baseline actions"
        detail={baseline ? `${baseline.levelCount} levels added up` : 'no baseline for this game'}
        title={
          baseline
            ? `ARC's own per-level action baseline for the current build (${baseline.build}), from the game's metadata.json. Per level: ${baseline.baselineActions.join(', ')}.`
            : 'No ARC baseline is recorded for this game.'
        }
      />
      <StatCell
        value={stats?.fewestActions ?? '—'}
        label="Fewest human actions (top 10)"
        detail={fewestDetail}
        title={`Fewest actions among ARC Prize top-10 rows that won and were published on or after ${CUTOFF_DAY}.`}
      />
      <StatCell
        value={stats?.medianActions ?? '—'}
        label="Top-10 median actions"
        detail={medianDetail}
        title={`Median actions among ARC Prize top-10 rows that won and were published on or after ${CUTOFF_DAY}. With an even count it is the average of the middle two, so it can end in .5.`}
      />
      <StatCell value={ownerValue} label={ownerLabel} detail={ownerDetail} title={ownerTitle} />
    </div>
  );
}

const DIFFICULTY_STYLES: Record<DifficultyRating, string> = {
  easy: 'bg-green-50 text-green-700 border-green-300',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-300',
  hard: 'bg-orange-50 text-orange-700 border-orange-300',
  'very-hard': 'bg-red-50 text-red-700 border-red-300',
  unknown: 'bg-gray-50 text-gray-500 border-gray-300',
};

const DIFFICULTY_LABELS: Record<DifficultyRating, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  'very-hard': 'Very Hard',
  unknown: 'Unknown',
};

/**
 * Separate difficulty signals, deliberately kept apart rather than averaged into one
 * badge: the top-10 rating comes from the ARC Prize human leaderboard, the owner rating
 * from his own scorecards, and aiDifficulty from a dated snapshot of our own competition
 * run data. They disagree often enough (su15 is hard on the top-10 spread and medium for
 * the owner) that collapsing them into one number would hide the more interesting fact.
 *
 * `label` replaces the rating word (e.g. "Not played yet"); `note` is added after it in
 * brackets (e.g. "not won yet").
 */
function DifficultyBadge({
  icon: Icon,
  prefix,
  difficulty,
  title,
  label,
  note,
}: {
  icon: typeof User;
  prefix: string;
  difficulty: DifficultyRating;
  title: string;
  label?: string;
  note?: string;
}) {
  return (
    <Badge variant="outline" className={DIFFICULTY_STYLES[difficulty]} title={title}>
      <Icon className="h-3 w-3 mr-1" />
      {prefix}: {label ?? DIFFICULTY_LABELS[difficulty]}
      {note ? ` (${note})` : ''}
    </Badge>
  );
}

/** Rating, bracketed note and the exact tooltip for the "Human (top 10)" badge. */
function describeTop10Rating(
  board: HumanLeaderboard | undefined,
  boardFailed: boolean,
): { rating: DifficultyRating; note?: string; title: string } {
  const rule =
    `From the ARC Prize human top-10 board for this game. Only rows that won and were published on or after ` +
    `${CUTOFF_DAY} count. Spread = (most actions - fewest actions) / fewest actions across those rows: ` +
    `under ${TOP10_EASY_BELOW.toFixed(2)} is easy, under ${TOP10_HARD_AT.toFixed(2)} is medium, ` +
    `${TOP10_HARD_AT.toFixed(2)} or more is hard. Fewer than ${TOP10_MIN_RECENT_WINS} recent wins gives unknown. ` +
    `Resets and scores are not used.`;
  if (!board) {
    return {
      rating: 'unknown',
      title: `${rule} The leaderboard ${boardFailed ? 'could not be loaded' : 'is still loading'}, so there is no rating yet.`,
    };
  }
  const { stats } = board;
  const rating = top10Difficulty(stats);
  const spread = stats.relativeSpread !== null ? `, spread ${stats.relativeSpread.toFixed(2)}` : '';
  return {
    rating,
    note: rating === 'unknown' ? plural(stats.recentWins, 'recent win') : undefined,
    title: `${rule} This game: ${plural(stats.recentWins, 'recent win')}${spread}.`,
  };
}

/** Rating, label, bracketed note and the exact tooltip for the owner's badge. */
function describeOwnerRating(owner: OwnerGameRating): {
  rating: DifficultyRating;
  label?: string;
  note?: string;
  title: string;
} {
  const { summary, calibration } = owner;
  const medianEffort = calibration.medianEffort;
  const rule =
    `From ${OWNER_PLAYER}'s own arcprize.org scorecards: runs with at least one action, opened on or after ` +
    `${CUTOFF_DAY}, on the current game build. Effort = actions on his best win, plus actions on every run ` +
    `that did not win before his first win, divided by ARC's baseline total for the game. ` +
    (medianEffort !== null
      ? `That is compared with his median effort over the ${calibration.gamesWon} games he has won (${medianEffort.toFixed(2)}): `
      : `That is compared with his median effort over the games he has won (he needs ${OWNER_MIN_WON_GAMES} or more; he has ${calibration.gamesWon}, so there is no median yet): `) +
    `${OWNER_EASY_AT_OR_BELOW}x his median or less is easy, under ${OWNER_HARD_AT}x is medium, ` +
    `under ${OWNER_VERY_HARD_AT}x is hard, ${OWNER_VERY_HARD_AT}x or more is very hard. ` +
    `A game he has not won yet is rated at least hard, because his actions so far are only a floor.`;

  if (!summary) {
    return {
      rating: 'unknown',
      label: 'Not played yet',
      title: `${rule} This game: no runs yet.`,
    };
  }
  if (!summary.won) {
    return {
      rating: owner.rating,
      note: 'not won yet',
      title:
        `${rule} This game: not won yet, ${summary.actionsSpent} actions over ${plural(summary.recentRuns, 'run')} so far. ` +
        `The rating says the game is unfinished for him, not how hard a win turned out to be.`,
    };
  }
  const ratio = medianEffort !== null && medianEffort > 0 && summary.effort !== null ? summary.effort / medianEffort : null;
  return {
    rating: owner.rating,
    title:
      `${rule} This game: effort ${summary.effort !== null ? summary.effort.toFixed(2) : 'n/a'}` +
      (ratio !== null ? `, ${ratio.toFixed(2)}x his median.` : '.'),
  };
}

const MECHANIC_CATEGORY_ORDER: readonly MechanicPoint['category'][] = [
  'controls',
  'goal',
  'pieces',
  'hazards',
  'budget',
  'feedback',
  'other',
];

function mechanicCategoryRank(point: MechanicPoint): number {
  const index = MECHANIC_CATEGORY_ORDER.indexOf(point.category);
  return index === -1 ? MECHANIC_CATEGORY_ORDER.length : index;
}

/**
 * Bullets grouped by the level that introduces them (no level = level 1), groups in level
 * order, and bullets ordered by category inside a group. Array sort is stable, so bullets
 * of the same category keep the order they were written in.
 */
function groupMechanicsByLevel(points: readonly MechanicPoint[]): { level: number; points: MechanicPoint[] }[] {
  const byLevel = new Map<number, MechanicPoint[]>();
  for (const point of points) {
    const level = point.introducedOnLevel && point.introducedOnLevel > 1 ? point.introducedOnLevel : 1;
    const group = byLevel.get(level);
    if (group) group.push(point);
    else byLevel.set(level, [point]);
  }
  return Array.from(byLevel.entries())
    .sort(([a], [b]) => a - b)
    .map(([level, group]) => ({
      level,
      points: [...group].sort((a, b) => mechanicCategoryRank(a) - mechanicCategoryRank(b)),
    }));
}

/**
 * "Every Mechanic": the full bullet list from mechanicsBreakdown, under "From level 1" and
 * then "New on level N". Renders nothing for a game that has no breakdown yet.
 */
function EveryMechanicCard({ points }: { points: MechanicPoint[] | undefined }) {
  if (!points || points.length === 0) return null;
  const groups = groupMechanicsByLevel(points);

  return (
    <Card className="mb-12">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl flex items-center gap-2">
          <ListChecks className="h-5 w-5" />
          Every Mechanic
        </CardTitle>
        <CardDescription>
          Each point was checked in the game's source code. They are listed under the level where
          they first show up; the small print says where in the code.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {groups.map(({ level, points: groupPoints }) => (
          <section key={level}>
            <h3 className="text-sm font-semibold mb-2">
              {level === 1 ? 'From level 1' : `New on level ${level}`}
            </h3>
            <ul className="list-disc pl-5 space-y-2.5 marker:text-muted-foreground">
              {groupPoints.map((point, index) => (
                <li key={`${level}-${index}`} className="text-base leading-relaxed">
                  {point.text}
                  {point.source && (
                    <span className="block font-mono text-[11px] leading-snug text-muted-foreground mt-0.5">
                      {point.source}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * "Notes From Play": what a human actually noticed while playing, in the saw / did / expected
 * / happened, with what the code says underneath.
 * Ordered by level. Renders nothing when a game has no notes.
 */
function NotesFromPlayCard({ notes }: { notes: PlayerObservation[] | undefined }) {
  if (!notes || notes.length === 0) return null;
  const ordered = [...notes].sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  const rows: { label: string; key: keyof PlayerObservation }[] = [
    { label: 'Saw', key: 'saw' },
    { label: 'Did', key: 'did' },
    { label: 'Expected', key: 'expected' },
    { label: 'What happened', key: 'happened' },
    { label: 'In the code', key: 'inCode' },
  ];

  return (
    <Card className="mb-12">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl flex items-center gap-2">
          <User className="h-5 w-5" />
          Notes From Play
        </CardTitle>
        <CardDescription>What a human noticed while actually playing, close to their own words.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {ordered.map((note, index) => (
          <div key={index} className="border-l-2 border-primary/30 pl-4">
            <p className="text-xs text-muted-foreground mb-1.5">
              {note.player} · {note.date}
              {typeof note.level === 'number' ? ` · level ${note.level}` : ''}
            </p>
            <dl className="space-y-1.5">
              {rows
                .filter(({ key }) => typeof note[key] === 'string' && note[key])
                .map(({ label, key }) => (
                  <div key={key} className="grid grid-cols-[7.5rem_1fr] gap-2 text-sm">
                    <dt className="font-semibold text-muted-foreground">{label}</dt>
                    <dd className={key === 'inCode' ? 'text-muted-foreground' : ''}>{note[key]}</dd>
                  </div>
                ))}
            </dl>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * Game not found component
 */
function GameNotFound({ gameId }: { gameId: string }) {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button variant="ghost" size="sm" className="mb-4">
        <Link href="/arc3">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to ARC-AGI-3
        </Link>
      </Button>
      <Card className="text-center py-12">
        <CardContent>
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Game Not Found</h1>
          <p className="text-muted-foreground mb-4">
            We don't have information about game "{gameId}" yet.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            This game may exist on the ARC-AGI-3 platform but hasn't been documented here.
          </p>
          <div className="flex gap-3 justify-center">
            <Button asChild variant="outline">
              <a
                href={`https://three.arcprize.org/games/${gameId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Try on Official Site
              </a>
            </Button>
            <Button asChild>
              <Link href="/arc3/archive/games">
                Browse Known Games
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Arc3GameSpoiler() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId || '';
  const game = getGameById(gameId);

  /**
   * Previous/next game in ARC Prize's own alphabetical presentation of the 25-game
   * public demo set (AR25 first, WA30 last) -- not our category-then-id sort.
   */
  const { prevId, nextId } = getAdjacentGameIds(gameId);
  const prevGame = prevId ? getGameById(prevId) : null;
  const nextGame = nextId ? getGameById(nextId) : null;

  usePageMeta({
    title: game 
      ? `ARC Explainer – ${game.informalName || game.gameId} (ARC-AGI-3 Game)`
      : `ARC Explainer – Game Not Found`,
    description: game
      ? `Spoilers, mechanics, and any hints or resources we've documented so far for ARC-AGI-3 game ${game.gameId}${game.informalName ? ` (${game.informalName})` : ''}. ${game.description}`
      : `Game not found in the ARC-AGI-3 database.`,
    canonicalPath: `/arc3/games/${gameId}`,
  });

  /**
   * The id the play surface serves this game under, or null when it serves none.
   *
   * The mirror publishes the official games with a version suffix (`sc25` ->
   * `sc25-635fd71a`) that comes from upstream's manifest and is not ours to hardcode, so
   * it is matched by prefix here. A few games publish more than one version; the sorted
   * first is taken so the link is stable across catalog refreshes. No match means no
   * button -- CommunityGamePlay cannot serve a task the catalog does not list.
   */
  const { data: catalog } = useQuery<{ data: { games: { gameId: string }[] } }>({
    queryKey: ['/api/arc3-mirror/games'],
    staleTime: 5 * 60 * 1000,
  });
  const playId = React.useMemo(() => {
    if (!gameId) return null;
    const matches = (catalog?.data?.games ?? [])
      .map((g) => g.gameId)
      .filter((id) => id === gameId || id.startsWith(`${gameId}-`))
      .sort();
    return matches[0] ?? null;
  }, [catalog, gameId]);

  /**
   * The ARC Prize human top-10 board, fetched once here and shared by the action strip,
   * the "Human (top 10)" badge and HumanRecordsCard. Someone else's service: no retry,
   * and every consumer renders without it.
   */
  const { data: leaderboardResponse, isError: leaderboardFailed } = useQuery<{ data: HumanLeaderboard }>({
    queryKey: [`/api/arc3/leaderboard/${gameId}`],
    staleTime: 60 * 60 * 1000,
    retry: false,
    enabled: Boolean(game),
  });
  const board = leaderboardResponse?.data;

  if (!game) {
    return <GameNotFound gameId={gameId} />;
  }

  const owner = getOwnerGameRating(game.gameId);
  const top10Badge = describeTop10Rating(board, leaderboardFailed);
  const ownerBadge = describeOwnerRating(owner);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Top nav -- same Previous/Next pair as the footer, so a reader working through
          the set in order (AR25 -> ... -> WA30) doesn't have to scroll down every time. */}
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <Button asChild variant="ghost" size="sm">
          <Link href="/arc3">
            <ArrowLeft className="h-4 w-4 mr-1" />
            ARC-AGI-3
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          {prevGame && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/arc3/games/${prevGame.gameId}`}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                {prevGame.informalName || prevGame.gameId}
              </Link>
            </Button>
          )}
          {nextGame && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/arc3/games/${nextGame.gameId}`}>
                {nextGame.informalName || nextGame.gameId}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Hero Section */}
      <div className="mb-12">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Gamepad2 className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">
                {game.informalName || game.gameId}
              </h1>
              {game.isFullyDocumented && (
                <span title="Fully documented">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-sm bg-muted px-2 py-1 rounded">{game.gameId}</code>
              <Badge
                variant={game.category === 'preview' ? 'default' : 'secondary'}
                className={game.category === 'preview' ? 'bg-blue-500' : 'bg-purple-500 text-white'}
              >
                {game.category === 'preview' ? (
                  <><Unlock className="h-3 w-3 mr-1" /> Preview Game</>
                ) : (
                  <><Lock className="h-3 w-3 mr-1" /> Evaluation Game</>
                )}
              </Badge>
              <DifficultyBadge
                icon={User}
                prefix="Human (top 10)"
                difficulty={top10Badge.rating}
                note={top10Badge.note}
                title={top10Badge.title}
              />
              <DifficultyBadge
                icon={User}
                prefix={`Human (${OWNER_PLAYER})`}
                difficulty={ownerBadge.rating}
                label={ownerBadge.label}
                note={ownerBadge.note}
                title={ownerBadge.title}
              />
              <DifficultyBadge
                icon={Bot}
                prefix="AI"
                difficulty={game.aiDifficulty}
                title="Snapshot from our own competition run data -- not live, not every run"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {playId && (
              <Button asChild>
                <Link href={`/arc3/play/${playId}`}>
                  <Play className="h-4 w-4 mr-2" />
                  Play
                </Link>
              </Button>
            )}
            {/* How people actually do on this exact task, from ARC Prize rather than from
                us -- the one number on this page we are not the source for. */}
            <Button asChild variant="outline">
              <a href={arcPrizeLeaderboardUrl(game.gameId)} target="_blank" rel="noopener noreferrer">
                <Trophy className="h-4 w-4 mr-2" />
                Human Leaderboard
              </a>
            </Button>
          </div>
        </div>
        <p className="text-lg text-muted-foreground">
          {game.description}
        </p>
        <ActionCountStrip
          gameId={game.gameId}
          owner={owner}
          board={board}
          boardFailed={leaderboardFailed}
        />
      </div>

      <Card className="mb-12 border-2 border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">In Plain English</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-base leading-relaxed">{game.simpleExplanation}</p>
        </CardContent>
      </Card>

      <EveryMechanicCard points={game.mechanicsBreakdown} />

      <NotesFromPlayCard notes={game.playerObservations} />

      {/* Screenshots -- lead with these. Pictures of the game and its levels come before
          records, replays, and write-ups, not after them. */}
      {game.levelScreenshots && game.levelScreenshots.length > 0 && (
        <Card className="mb-12">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Level Screenshots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {game.levelScreenshots
                .sort((a: LevelScreenshot, b: LevelScreenshot) => a.level - b.level)
                .map((screenshot: LevelScreenshot) => (
                  <div key={screenshot.imageUrl} className="border rounded-lg overflow-hidden bg-muted">
                    <div className="p-3 bg-muted/80 border-b">
                      <p className="font-semibold text-sm">
                        Level {screenshot.level}
                        {screenshot.caption && ` – ${screenshot.caption}`}
                      </p>
                    </div>
                    <div className="relative aspect-square">
                      <img
                        src={screenshot.imageUrl}
                        alt={`Level ${screenshot.level}${screenshot.caption ? ` - ${screenshot.caption}` : ''}`}
                        className="w-full h-full object-contain"
                        style={{ imageRendering: 'pixelated' }}
                        loading="lazy"
                      />
                    </div>
                    {screenshot.notes && (
                      <div className="p-3 border-t">
                        <p className="text-xs text-muted-foreground italic">
                          {screenshot.notes}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <HumanRecordsCard gameId={game.gameId} board={board} />

      {/* Featured Replay */}
      {game.video && (
        <Card className="mb-12 shadow-lg border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5" />
              Featured Replay
            </CardTitle>
            <CardDescription>
              Captured directly from the ARC-3 streaming pipeline
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <video
              className="w-full rounded-xl border border-border"
              controls
              preload="metadata"
              poster={game.video.poster}
            >
              <source src={game.video.src} type="video/mp4" />
              Your browser does not support embedded ARC3 replays.{' '}
              <a href={game.video.src} target="_blank" rel="noopener noreferrer">
                Download the MP4
              </a>{' '}
              to watch locally.
            </video>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {game.video.caption || 'Recorded run powered by ARC Explainer agents.'}
              </p>
              <Button variant="outline" size="sm" asChild>
                <a href={game.video.src} download>
                  <Download className="h-4 w-4 mr-2" />
                  Download MP4
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* How It Works - CENTERPIECE */}
      <div className="mb-12 space-y-6">
        {game.mechanicsExplanation && (
          <Card className="border-2">
            <CardHeader className="pb-4">
              <CardTitle className="text-3xl font-bold flex items-center gap-3">
                <BookOpen className="h-8 w-8" />
                How It Works
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap font-sans text-base text-foreground font-semibold leading-relaxed">
                {game.mechanicsExplanation.trim()}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Action Mappings */}
        {game.actionMappings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Keyboard className="h-5 w-5" />
                Action Mappings
              </CardTitle>
              <CardDescription>
                What each action does in this game
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {game.actionMappings.map((mapping: ActionMapping) => (
                  <div
                    key={mapping.action}
                    className="flex items-start gap-3 p-3 bg-muted rounded-lg"
                  >
                    <Badge variant="default" className="font-mono">
                      {mapping.action}
                    </Badge>
                    {mapping.commonName && (
                      <Badge variant="outline">{mapping.commonName}</Badge>
                    )}
                    <div className="flex-1">
                      <p className="text-sm">{mapping.description}</p>
                      {mapping.notes && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {mapping.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Replays */}
        {game.resources.filter((r: GameResource) => r.type === 'replay').length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gamepad2 className="h-5 w-5" />
                Notable Playthroughs
              </CardTitle>
              <CardDescription>
                Watch expert players complete this game
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {game.resources
                  .filter((r: GameResource) => r.type === 'replay')
                  .map((replay: GameResource, idx: number) => (
                    <a
                      key={idx}
                      href={replay.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg hover:from-primary/15 hover:to-primary/10 transition-colors border border-primary/20"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-semibold text-primary hover:underline">
                            {replay.title}
                          </h4>
                          {replay.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {replay.description}
                            </p>
                          )}
                        </div>
                        <Badge variant="default" className="ml-2 whitespace-nowrap">
                          Watch <ExternalLink className="h-3 w-3 ml-1" />
                        </Badge>
                      </div>
                    </a>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resources */}
        {game.resources.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                External Resources
              </CardTitle>
              <CardDescription>
                Articles, videos, and discussions about this game
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {game.resources
                  .filter((r: GameResource) => r.type !== 'replay')
                  .map((resource: GameResource, idx: number) => (
                    <a
                      key={idx}
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-medium text-primary hover:underline">
                            {resource.title}
                          </h4>
                          {resource.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {resource.description}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {resource.type}
                        </Badge>
                      </div>
                    </a>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tags */}
        {game.tags.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {game.tags.map((tag: string) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {game.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{game.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Links Footer */}
      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-3 justify-center">
            <Button asChild variant="outline" size="sm">
              <Link href="/arc3">
                <ArrowLeft className="h-4 w-4 mr-1" />
                ARC-AGI-3
              </Link>
            </Button>
            {prevGame && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/arc3/games/${prevGame.gameId}`}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Previous: {prevGame.informalName || prevGame.gameId}
                </Link>
              </Button>
            )}
            {nextGame && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/arc3/games/${nextGame.gameId}`}>
                  Next: {nextGame.informalName || nextGame.gameId}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            )}
            {playId && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/arc3/play/${playId}`}>
                  <Play className="h-4 w-4 mr-1" />
                  Play
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <a href={arcPrizeLeaderboardUrl(game.gameId)} target="_blank" rel="noopener noreferrer">
                <Trophy className="h-4 w-4 mr-1" />
                Human Leaderboard
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a
                href={`https://three.arcprize.org/games/${game.gameId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Official Site
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
