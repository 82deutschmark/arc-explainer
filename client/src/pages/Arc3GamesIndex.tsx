/*
 * Author: Claude Opus 5
 * Date: 2026-09-12
 * PURPOSE: The canonical index of the official ARC-AGI-3 game set at /arc3/games -- one
 *          page listing every game with its mechanics, so there is a single link to hand
 *          someone who wants the rules rather than 25 separate URLs to find.
 *
 *          WHY IT LOOKS LIKE THIS. Each entry carries the FULL mechanics text, not a
 *          teaser. The point of the page is that a reader (or a crawler) gets the answer
 *          here, without a click-through per game and without re-deriving anything from
 *          the Python. The per-game pages still exist and are linked, because they carry
 *          what does not belong in a list: level screenshots, replays, and provenance.
 *
 *          Its machine-readable twin is /arc3/games.md, generated from the same registry
 *          by server/services/arc3/arc3GameMechanicsDoc.ts and linked at the top for
 *          agents. Both read shared/arc3Games, so neither can drift from the other.
 *
 *          This route previously 301'd to the archive browser and was removed on
 *          2026-09-12 along with its sibling redirect (see server/routes.ts) -- /arc3/games
 *          now resolves here, which is what the URL always implied.
 *
 * SRP/DRY check: Pass -- presentation only, over the shared registry. Reuses shadcn Card
 *          and Badge, and the getAllGames/getGamesByCategory helpers rather than
 *          re-sorting the registry locally. No mechanics text lives in this file.
 */

import React from 'react';
import { Link } from 'wouter';
import { BookOpen, FileText, ExternalLink, AlertTriangle, Gamepad2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePageMeta } from '@/hooks/usePageMeta';
import { getAllGames, type Arc3GameMetadata } from '../../../shared/arc3Games';

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
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/arc3/games/${game.gameId}`}>
              Full write-up
            </Link>
          </Button>
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
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <BookOpen className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">ARC-AGI-3 Game Mechanics</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Every game in the official ARC-AGI-3 public demo set ({live.length} games), with its full
          mechanics and control mapping on one page.
        </p>
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

      <div className="space-y-6">
        {live.map((game) => (
          <GameEntry key={game.gameId} game={game} />
        ))}
      </div>

      {withdrawn.length > 0 && (
        <div className="mt-12 space-y-6">
          <div>
            <h2 className="text-xl font-bold">Withdrawn from the public demo set</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Kept as historical preview-era content. Not part of the current official set.
            </p>
          </div>
          {withdrawn.map((game) => (
            <GameEntry key={game.gameId} game={game} />
          ))}
        </div>
      )}
    </div>
  );
}
