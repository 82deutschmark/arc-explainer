/*
 * Author: Claude Opus 5; modernized into a searchable landing page by Claude Sonnet 5, 2026-09-12
 * Date: 2026-09-12 (searchable landing page added 2026-09-12)
 * PURPOSE: The canonical index of the official ARC-AGI-3 game set at /arc3/games -- the
 *          front door for "what are these 25 games", which is now also the nav's lead
 *          ARC-3 link instead of the deprecated agent playground. A live search box over
 *          a scannable card grid lets a reader find one game by name/id/tag/mechanic
 *          without scrolling a 25-entry page; the grid links through to that game's own
 *          page (screenshots, replays, human records) rather than scrolling here.
 *
 *          WHY THE FULL TEXT STILL FOLLOWS THE GRID. Each entry below the grid still
 *          carries the FULL mechanics text, not a teaser -- a reader (or a crawler) gets
 *          the answer here without a click-through per game and without re-deriving
 *          anything from the Python. That dump is filtered by the same search box, so
 *          search narrows both halves of the page at once.
 *
 *          Its machine-readable twin is /arc3/games.md, generated from the same registry
 *          by server/services/arc3/arc3GameMechanicsDoc.ts and linked at the top for
 *          agents. Both read shared/arc3Games, so neither can drift from the other.
 *          2026-09-19 (Claude Opus 5): Slippery Seven badge on tiles and entries.
 *          2026-09-18 (Claude Opus 5): no 90-day cut on the top-10 numbers or Boss's count.
 *
 *          2026-09-16 (Claude Opus 5, later): every tile shows actions to win -- the fewest on
 *          the top-10 board, Boss's own count, and ARC's baseline -- and the
 *          grid can be sorted by fewest actions, because Boss rates a game as easier the
 *          fewer actions it takes. Top-10 numbers come from /api/arc3/leaderboards/summary.
 *          2026-09-16 (Claude Opus 5): added the tutorial card right under the intro,
 *          quoting François Chollet (from his recent post on X) in Boss's wording:
 *          the 25 public games are the tutorial for the private set.
 *
 * SRP/DRY check: Pass -- presentation + client-side filtering only, over the shared
 *          registry. Reuses shadcn Card, Badge and Input, and the getAllGames helper
 *          rather than re-sorting the registry locally. No mechanics text lives in this
 *          file; the search predicate reads the same Arc3GameMetadata fields already
 *          rendered, so it can't drift from what's on screen.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { BookOpen, FileText, ExternalLink, AlertTriangle, Gamepad2, GraduationCap, Trophy, Search, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { usePageMeta } from '@/hooks/usePageMeta';
import { arcPrizeLeaderboardUrl, getAllGames, type Arc3GameMetadata } from '../../../shared/arc3Games';
import { getOwnerGameRating, OWNER_PLAYER } from '../../../shared/arc3Games/humanDifficulty';
import { SlipperySevenBadge } from '@/components/arc3/SlipperySevenBadge';

/** Per-game top-10 action counts (every winning row), from /api/arc3/leaderboards/summary. */
interface TopActionSummary {
  fewestActions: number | null;
  medianActions: number | null;
  wins: number;
}

/** The three action counts a tile shows. Null where there is no number to show. */
interface GameActionCounts {
  topFewest: number | null;
  owner: number | null;
  ownerWon: boolean;
  baseline: number | null;
}

function actionCountsFor(gameId: string, top: TopActionSummary | null | undefined): GameActionCounts {
  const owner = getOwnerGameRating(gameId);
  const summary = owner.summary;
  return {
    topFewest: top?.fewestActions ?? null,
    owner: summary ? (summary.bestWin ? summary.bestWin.actions : summary.actionsSpent) : null,
    ownerWon: Boolean(summary?.won),
    baseline: owner.baseline?.baselineTotal ?? null,
  };
}

/**
 * Sort key for "fewest actions first": the top-10's fewest when there is one, else ARC's
 * baseline, else last. Boss judges a game by how few actions it takes to beat.
 */
function actionsSortKey(counts: GameActionCounts): number {
  return counts.topFewest ?? counts.baseline ?? Number.POSITIVE_INFINITY;
}

/** Lowercased, whitespace-collapsed haystack of every field a search should match. */
function searchHaystack(game: Arc3GameMetadata): string {
  return [
    game.gameId,
    game.officialTitle,
    game.informalName,
    game.description,
    game.simpleExplanation,
    game.mechanicsExplanation,
    game.category,
    ...game.tags,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function matchesQuery(game: Arc3GameMetadata, query: string): boolean {
  if (!query.trim()) return true;
  const needle = query.trim().toLowerCase();
  return searchHaystack(game).includes(needle);
}

/** The scannable card grid: one tile per game, linking straight to its own page. */
function GameGridTile({ game, counts }: { game: Arc3GameMetadata; counts: GameActionCounts }) {
  const thumbnail = [...(game.levelScreenshots ?? [])].sort((a, b) => a.level - b.level)[0];

  return (
    <Link
      href={`/arc3/games/${game.gameId}`}
      className="group block rounded-lg border bg-card overflow-hidden transition-colors hover:border-primary/50 hover:bg-accent/40"
    >
      <div className="aspect-square bg-muted overflow-hidden">
        {thumbnail ? (
          <img
            src={thumbnail.imageUrl}
            alt={`${game.informalName || game.gameId} level ${thumbnail.level}`}
            className="w-full h-full object-contain"
            style={{ imageRendering: 'pixelated' }}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Gamepad2 className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <code className="text-xs font-semibold">{game.gameId}</code>
          {typeof game.levelCount === 'number' && (
            <span className="text-[11px] text-muted-foreground">{game.levelCount}lv</span>
          )}
        </div>
        <p className="text-sm font-medium mt-1 truncate">{game.informalName || game.officialTitle}</p>
        <SlipperySevenBadge gameId={game.gameId} className="mt-1 text-[10px] px-1.5 py-0" />
        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{game.simpleExplanation}</p>
        <dl className="grid grid-cols-3 gap-1 mt-2 pt-2 border-t text-center">
          <div title="Fewest actions to win on the ARC Prize top-10 board">
            <dd className="text-sm font-bold tabular-nums">{counts.topFewest ?? '—'}</dd>
            <dt className="text-[10px] text-muted-foreground">top 10</dt>
          </div>
          <div
            title={
              counts.owner === null
                ? `${OWNER_PLAYER} has not played this yet`
                : counts.ownerWon
                  ? `${OWNER_PLAYER}'s best win`
                  : `${OWNER_PLAYER}'s actions so far, not won yet`
            }
          >
            <dd className="text-sm font-bold tabular-nums">
              {counts.owner ?? '—'}
              {counts.owner !== null && !counts.ownerWon && <span className="text-muted-foreground font-normal">*</span>}
            </dd>
            <dt className="text-[10px] text-muted-foreground">{OWNER_PLAYER}</dt>
          </div>
          <div title="ARC Prize's baseline actions for the whole game">
            <dd className="text-sm font-bold tabular-nums text-muted-foreground">{counts.baseline ?? '—'}</dd>
            <dt className="text-[10px] text-muted-foreground">baseline</dt>
          </div>
        </dl>
      </div>
    </Link>
  );
}

/**
 * What these 25 games are for, said before anything else on the page: they are the
 * tutorial for the private set, in François Chollet's framing.
 */
function TutorialFramingCard({ gameCount }: { gameCount: number }) {
  return (
    <Card className="mb-6 border-2 border-foreground/15">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl flex items-center gap-2">
          <GraduationCap className="h-5 w-5" />
          These {gameCount} games are the tutorial
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-relaxed">
        <blockquote className="border-l-2 border-muted-foreground/30 pl-3">
          <p className="text-base">
            “This is the tutorial. These {gameCount} games, you should consider this the tutorial for the
            private set.”
          </p>
          <footer className="mt-1 text-muted-foreground">— François Chollet</footer>
        </blockquote>
        <p>
          They don't cover everything the private set will throw at you, but learn how these {gameCount} work
          and you should be able to do okay on it.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * as66 sits in the registry for its historical preview-era content but is no longer in
 * the public demo set, so it is listed apart rather than inflating the live count.
 */
const WITHDRAWN_IDS = new Set(['as66']);

function GameEntry({ game }: { game: Arc3GameMetadata }) {
  return (
    <Card id={game.gameId} className="scroll-mt-20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-2xl">
              {game.informalName || game.gameId}
            </CardTitle>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <code className="text-xs bg-muted px-2 py-1 rounded">{game.gameId}</code>
              <Badge variant={game.category === 'preview' ? 'default' : 'secondary'}>
                {game.category === 'preview' ? 'Preview' : 'Evaluation'}
              </Badge>
              {typeof game.levelCount === 'number' && (
                <Badge variant="outline">{game.levelCount} levels</Badge>
              )}
              <SlipperySevenBadge gameId={game.gameId} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={arcPrizeLeaderboardUrl(game.gameId)} target="_blank" rel="noopener noreferrer">
                <Trophy className="h-4 w-4 mr-1" />
                Leaderboard
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/arc3/games/${game.gameId}`}>
                Full write-up
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{game.description}</p>
        {game.mechanicsExplanation && (
          <p className="text-base leading-relaxed">{game.mechanicsExplanation.trim()}</p>
        )}
        {game.actionMappings.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {game.actionMappings.map((m) => (
              <span
                key={m.action}
                className="text-xs bg-muted rounded px-2 py-1"
                title={m.description}
              >
                <code className="font-mono">{m.action}</code>
                {m.commonName ? ` ${m.commonName}` : ` ${m.description}`}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Arc3GamesIndex() {
  const all = getAllGames() as Arc3GameMetadata[];
  const live = all.filter((g) => !WITHDRAWN_IDS.has(g.gameId));
  const withdrawn = all.filter((g) => WITHDRAWN_IDS.has(g.gameId));

  const [query, setQuery] = React.useState('');
  const [sortBy, setSortBy] = React.useState<'set' | 'fewest'>('set');

  const { data: summary } = useQuery<{ data: { games: Record<string, TopActionSummary | null> } }>({
    queryKey: ['/api/arc3/leaderboards/summary'],
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
  const countsById = React.useMemo(() => {
    const map = new Map<string, GameActionCounts>();
    for (const game of live) map.set(game.gameId, actionCountsFor(game.gameId, summary?.data?.games?.[game.gameId]));
    return map;
  }, [live, summary]);

  const filteredLive = React.useMemo(() => {
    const matched = live.filter((g) => matchesQuery(g, query));
    if (sortBy === 'set') return matched;
    return [...matched].sort(
      (a, b) => actionsSortKey(countsById.get(a.gameId)!) - actionsSortKey(countsById.get(b.gameId)!),
    );
  }, [live, query, sortBy, countsById]);
  const filteredWithdrawn = React.useMemo(
    () => withdrawn.filter((g) => matchesQuery(g, query)),
    [withdrawn, query],
  );
  const isFiltering = query.trim().length > 0;

  usePageMeta({
    title: 'ARC-AGI-3 Official Game Mechanics – Complete Reference',
    description:
      `Full mechanics for all ${live.length} official ARC-AGI-3 games: what each game is, what every ` +
      `action does, and how each one is won. Traced from the game sources and adversarially ` +
      `re-checked, so you do not have to reverse-engineer the Python yourself.`,
    canonicalPath: '/arc3/games',
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <BookOpen className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">ARC-AGI-3 Game Mechanics</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Every game in the official ARC-AGI-3 public demo set ({live.length} games), with its full
          mechanics and control mapping on one page.
        </p>
      </div>

      <TutorialFramingCard gameCount={live.length} />

      <div className="mb-8 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={'Search by name, game ID, tag, or mechanic (e.g. "sokoban", "ls20", "key")'}
            className="pl-9 pr-9 h-11 text-base"
            aria-label="Search the 25 official ARC-AGI-3 games"
          />
          {isFiltering && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-muted-foreground">
            {isFiltering
              ? `${filteredLive.length} of ${live.length} games match "${query.trim()}"`
              : `Showing all ${live.length} games`}
            {' · '}numbers are actions to win
          </p>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={sortBy}
            onValueChange={(value) => value && setSortBy(value as 'set' | 'fewest')}
            aria-label="Sort games"
          >
            <ToggleGroupItem value="set">ARC order</ToggleGroupItem>
            <ToggleGroupItem value="fewest">Fewest actions first</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {filteredLive.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-1">
            {filteredLive.map((game) => (
              <GameGridTile key={game.gameId} game={game} counts={countsById.get(game.gameId)!} />
            ))}
          </div>
        ) : (
          !isFiltering || filteredWithdrawn.length === 0 ? (
            <Card className="py-8 text-center text-sm text-muted-foreground">
              No games match "{query.trim()}". Try a game ID, mechanic, or tag instead.
            </Card>
          ) : null
        )}
      </div>

      <Card className="mb-8 border-primary/30 bg-primary/5">
        <CardContent className="py-5 space-y-3">
          <p className="text-sm">
            <strong>Read this instead of reverse-engineering the source.</strong> Each write-up was
            produced by reading that game's obfuscated Python and tracing its step and win
            conditions by hand, then adversarially re-checking every claim against the source a
            second time. That second pass found 57 real errors across 22 games — mostly level-1
            behaviour described as if it held for the whole game, mechanics that do not exist in
            the code at all, and unmentioned move budgets that lose a level outright. Deriving
            these rules yourself means making those mistakes again.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button asChild variant="outline" size="sm">
              <a href="/arc3/games.md">
                <FileText className="h-4 w-4 mr-1" />
                Plain Markdown (for agents)
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/arc3">
                <Gamepad2 className="h-4 w-4 mr-1" />
                Background &amp; technical report
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="https://three.arcprize.org" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" />
                Official site
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-8 border-amber-300 bg-amber-50 dark:bg-amber-950/20">
        <CardContent className="py-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm">
              <strong>Spoilers, by design.</strong> This page tells you the answers. If you plan to
              play these games yourself, or to contribute to a human baseline, play first — reading
              it makes your attempt useless as baseline data.
            </p>
          </div>
        </CardContent>
      </Card>

      {isFiltering && <h2 className="text-lg font-semibold mb-4">Full write-ups</h2>}
      <div className="space-y-6">
        {filteredLive.map((game) => (
          <GameEntry key={game.gameId} game={game} />
        ))}
      </div>

      {filteredWithdrawn.length > 0 && (
        <div className="mt-12 space-y-6">
          <div>
            <h2 className="text-xl font-bold">Withdrawn from the public demo set</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Kept as historical preview-era content. Not part of the current official set.
            </p>
          </div>
          {filteredWithdrawn.map((game) => (
            <GameEntry key={game.gameId} game={game} />
          ))}
        </div>
      )}
    </div>
  );
}
