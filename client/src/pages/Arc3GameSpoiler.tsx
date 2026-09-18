/*
 * Author: Cascade (ChatGPT); updated by Claude Opus 5, 2026-09-12; updated by Claude Sonnet 5, 2026-09-12
 * Date: 2026-02-10 (last updated 2026-09-18)
 * PURPOSE: Individual game page for the ARC-AGI-3 public games, at /arc3/games/:gameId.
 *          2026-09-12: the Play button goes into the blind play surface. The play id is NOT the
 *          page id: the mirror publishes the official games under a versioned id
 *          (`sc25` -> `sc25-635fd71a`), so it is resolved at render time from
 *          /api/arc3-mirror/games, and when the catalog has no match the button is not rendered.
 *          2026-09-16 (Claude Opus 5): action counts up top and two human ratings (top 10, Boss).
 *          2026-09-18 (Claude Opus 5): REBUILT LEVEL BY LEVEL, per the glow-up brief
 *          (docs/plans/2026-09-18-arc3-game-page-glowup-and-dataset-prd.md) and its dc22 mockup.
 *          Boss's complaint: the rules and the pictures were in two different places, and the
 *          rules were there twice (bullets, then the How It Works prose). Now, top to bottom:
 *            1. header: name, badges, description, Play / Human leaderboard, and a line on how
 *               to get a real scorecard on arcprize.org;
 *            2. the level strip: every level's opening frame, sticky, click to jump;
 *            3. at a glance: plain English with the four action counts, and the controls;
 *            4. one section per level: pictures on the left, that level's rules and notes from
 *               play on the right;
 *            5. fold-outs: Human Records, and replays / sources / correction history.
 *          The How It Works prose card is gone (it said the same as the rules, unchecked); it
 *          stays in the data for /arc3/games.md and is still shown for a game with no rule list.
 *          This file is now layout only; the pieces are in client/src/components/arc3/gamePage/
 *          and the level cut is shared/arc3Games/gameLevels.ts, the same one the private
 *          dataset and the markdown export use.
 * SRP/DRY check: Pass - layout only. Level grouping in shared/arc3Games/gameLevels.ts, rating
 *          math in shared/arc3Games/humanDifficulty.ts, components in components/arc3/gamePage/.
 *          No new fetches: the one leaderboard query is shared.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'wouter';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  ExternalLink,
  Lock,
  Play,
  Trophy,
  Unlock,
  User,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePageMeta } from '@/hooks/usePageMeta';
import { arcPrizeLeaderboardUrl, getAdjacentGameIds, getGameById, type Arc3GameMetadata } from '@shared/arc3Games';
import { getArcBaseline, getOwnerGameRating, getPlayerRuns, OWNER_PLAYER } from '@shared/arc3Games/humanDifficulty';
import { buildGameLevels, pickHeadlineRun, runOnLevel } from '@shared/arc3Games/gameLevels';
import type { HumanLeaderboard } from '@/components/arc3/gamePage/humanLeaderboard';
import { ActionCountStrip } from '@/components/arc3/gamePage/ActionCountStrip';
import { DifficultyBadge, describeOwnerRating, describeTop10Rating } from '@/components/arc3/gamePage/DifficultyBadges';
import { ControlsCard } from '@/components/arc3/gamePage/ControlsCard';
import { SymbolLegendCard } from '@/components/arc3/gamePage/SymbolLegendCard';
import { LevelStrip } from '@/components/arc3/gamePage/LevelStrip';
import { LevelSection } from '@/components/arc3/gamePage/LevelSection';
import { PlayNote } from '@/components/arc3/gamePage/PlayNote';
import { FoldOut } from '@/components/arc3/gamePage/FoldOut';
import { HumanRecordsBody, humanRecordsSummary } from '@/components/arc3/gamePage/HumanRecords';
import { GameSources, gameSourcesSummary } from '@/components/arc3/gamePage/GameSources';

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


/** Previous / next game in ARC Prize's own alphabetical order, as outline buttons. */
function AdjacentGameButtons({ prevGame, nextGame, long = false }: {
  prevGame: Arc3GameMetadata | null;
  nextGame: Arc3GameMetadata | null;
  long?: boolean;
}) {
  return (
    <>
      {prevGame && (
        <Button asChild variant="outline" size="sm">
          <Link href={`/arc3/games/${prevGame.gameId}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {long ? 'Previous: ' : ''}
            {prevGame.informalName || prevGame.gameId}
          </Link>
        </Button>
      )}
      {nextGame && (
        <Button asChild variant="outline" size="sm">
          <Link href={`/arc3/games/${nextGame.gameId}`}>
            {long ? 'Next: ' : ''}
            {nextGame.informalName || nextGame.gameId}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      )}
    </>
  );
}

export default function Arc3GameSpoiler() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId || '';
  const game = getGameById(gameId) as Arc3GameMetadata | undefined;

  /**
   * Previous/next game in ARC Prize's own alphabetical presentation of the 25-game
   * public demo set (AR25 first, WA30 last) -- not our category-then-id sort.
   */
  const { prevId, nextId } = getAdjacentGameIds(gameId);
  const prevGame = prevId ? (getGameById(prevId) as Arc3GameMetadata) : null;
  const nextGame = nextId ? (getGameById(nextId) as Arc3GameMetadata) : null;

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
   * the "Human (top 10)" badge and the Human Records fold-out. Someone else's service: no
   * retry, and every consumer renders without it.
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
  const baseline = getArcBaseline(game.gameId);
  const runs = getPlayerRuns(OWNER_PLAYER, game.gameId);
  const headline = pickHeadlineRun(runs);
  const cut = buildGameLevels(game, runs, baseline);
  const hasRules = (game.mechanicsBreakdown?.length ?? 0) > 0;
  const recordsSummary = humanRecordsSummary(board);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
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
          <AdjacentGameButtons prevGame={prevGame} nextGame={nextGame} />
        </div>
      </div>

      {/* 1. Header */}
      <header className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-3xl font-bold">{game.informalName || game.gameId}</h1>
              <code className="text-sm bg-muted px-2 py-0.5 rounded">{game.gameId}</code>
              {game.isFullyDocumented && (
                <span title="Fully documented">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
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
              <Badge variant="outline" className="font-mono font-normal">
                {cut.levelCount} {cut.levelCount === 1 ? 'level' : 'levels'}
                {baseline ? ` · build ${baseline.build}` : ''}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {playId && (
              <Button asChild title="Look at the game here without a login. No scorecard is kept.">
                <Link href={`/arc3/play/${playId}`}>
                  <Play className="h-4 w-4 mr-2" />
                  Play
                </Link>
              </Button>
            )}
            {/* How people actually do on this exact task, from ARC Prize rather than from us. */}
            <Button asChild variant="outline">
              <a href={arcPrizeLeaderboardUrl(game.gameId)} target="_blank" rel="noopener noreferrer">
                <Trophy className="h-4 w-4 mr-2" />
                Human Leaderboard
              </a>
            </Button>
          </div>
        </div>
        <p className="mt-3 max-w-[75ch] text-base text-muted-foreground">{game.description}</p>
        <p className="mt-4 border-l-4 border-amber-500 bg-amber-50 px-3 py-2 text-sm text-foreground/80 dark:bg-amber-950/30">
          Want a real scorecard? Play this game on the official site: go to{' '}
          <a href="https://arcprize.org/platform" target="_blank" rel="noopener noreferrer" className="font-semibold underline">
            arcprize.org/platform
          </a>
          , log in with a Google or GitHub account (the only two options, and the login is easy to miss), and play
          as a human. Your scorecard is then locked to you. That is where the replays and {OWNER_PLAYER}'s numbers on
          this page come from.
        </p>
      </header>

      {/* 2. Level strip */}
      <LevelStrip levels={cut.levels} headline={headline} player={OWNER_PLAYER} />

      {/* 3. At a glance */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr] mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              In plain English
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base leading-relaxed">{game.simpleExplanation}</p>
            <ActionCountStrip gameId={game.gameId} owner={owner} board={board} boardFailed={leaderboardFailed} />
          </CardContent>
        </Card>
        <ControlsCard mappings={game.actionMappings} />
      </div>

      <SymbolLegendCard glyphs={game.symbolGlyphs} note={game.symbolGlyphsNote} />

      {cut.observationsAnyLevel.length > 0 && (
        <div className="mb-10 space-y-3">
          <h2 className="text-lg font-bold">Notes from play, whole game</h2>
          {cut.observationsAnyLevel.map((note, index) => (
            <PlayNote key={`${note.date}-${index}`} note={note} showLevel />
          ))}
        </div>
      )}

      {/* A game with no rule list yet (only as66, the withdrawn game) keeps its prose. */}
      {!hasRules && game.mechanicsExplanation && (
        <Card className="mb-10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xl">
              <BookOpen className="h-5 w-5" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-base leading-relaxed">{game.mechanicsExplanation.trim()}</p>
          </CardContent>
        </Card>
      )}

      {/* 4. One section per level */}
      <div className="mb-12">
        {cut.levels.map((level) => (
          <LevelSection
            key={level.level}
            level={level}
            headlineOnLevel={headline ? runOnLevel(headline, level.level - 1) : null}
            hasHeadline={headline !== null}
            player={OWNER_PLAYER}
            build={baseline?.build ?? null}
          />
        ))}
      </div>

      {/* 5. Fold-outs */}
      <div className="mb-10 space-y-3">
        {recordsSummary && (
          <FoldOut title="Human records" summary={recordsSummary}>
            <HumanRecordsBody gameId={game.gameId} board={board} />
          </FoldOut>
        )}
        <FoldOut title="Replays, sources and correction history" summary={gameSourcesSummary(game)}>
          <GameSources game={game} olderScreenshots={cut.extraScreenshots} />
        </FoldOut>
      </div>

      {/* Quick Links Footer */}
      <div className="flex flex-wrap gap-3 border-t pt-6">
        <Button asChild variant="outline" size="sm">
          <Link href="/arc3">
            <ArrowLeft className="h-4 w-4 mr-1" />
            ARC-AGI-3
          </Link>
        </Button>
        <AdjacentGameButtons prevGame={prevGame} nextGame={nextGame} long />
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
          <a href={`https://three.arcprize.org/games/${game.gameId}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-1" />
            Official Site
          </a>
        </Button>
      </div>
    </div>
  );
}
