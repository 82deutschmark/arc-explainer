/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-05
 * PURPOSE: Public page for the ARC Prize 2026 ARC-AGI-3 Kaggle leaderboard, at
 *          /kaggle-leaderboard. Every team on the public board, the medal cut lines, our
 *          team always highlighted, today's movers, a feed of score changes, starred-team
 *          trails, the race over time, and the full searchable table.
 *
 *          Moved here on 05-Oct-2026 from arc3.sonpham.net/leaderboard.html, which sits
 *          behind a Google sign-in beside private research. Everything shown is already
 *          public on Kaggle. The data is pushed every 30 minutes by the Mac Mini's snapshot
 *          job (scripts/leaderboard_snapshot.py in the arc-3 repo) to POST /api/kaggle/board.
 *
 *          Layout per the Boss: one compact title row, then the numbers straight away --
 *          no hero band, no lede paragraph ahead of the data.
 * SRP/DRY check: Pass - composition only. Data and merging live in
 *          components/kaggleLeaderboard/boardData.ts; each section is its own component.
 *          Unrelated to pages/Leaderboards.tsx, which ranks models on ARC puzzles.
 */

import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageMeta } from '@/hooks/usePageMeta';
import { KAGGLE_URL, ago, useKaggleBoard } from '@/components/kaggleLeaderboard/boardData';
import { BoardTiles } from '@/components/kaggleLeaderboard/BoardTiles';
import { ScoreByRankChart } from '@/components/kaggleLeaderboard/ScoreByRankChart';
import { TodayRecap } from '@/components/kaggleLeaderboard/TodayRecap';
import { WatchlistChart } from '@/components/kaggleLeaderboard/WatchlistChart';
import { MovesFeed } from '@/components/kaggleLeaderboard/MovesFeed';
import { RaceChart } from '@/components/kaggleLeaderboard/RaceChart';
import { TeamsTable } from '@/components/kaggleLeaderboard/TeamsTable';
import { useWatchlist } from '@/components/kaggleLeaderboard/useWatchlist';

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3 pt-4">
        <CardTitle className="text-base">{title}</CardTitle>
        {note && <CardDescription className="text-xs">{note}</CardDescription>}
      </CardHeader>
      <CardContent className="pb-4">{children}</CardContent>
    </Card>
  );
}

export default function KaggleLeaderboard() {
  usePageMeta({
    title: 'ARC-AGI-3 Kaggle Leaderboard – ARC Explainer',
    description:
      'Every team on the ARC Prize 2026 ARC-AGI-3 public Kaggle leaderboard, with medal lines, daily movers, score history and the race to the close.',
    canonicalPath: '/kaggle-leaderboard',
  });

  const { model, isLoading, error, isEmpty } = useKaggleBoard();
  const watch = useWatchlist(model);

  return (
    <div className="mx-auto max-w-[1400px] space-y-3 px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-xl font-semibold">ARC-AGI-3 Kaggle leaderboard</h1>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {model && (
            <span>
              Saved {ago(model.latest.fetched)} · {model.latest.teams.toLocaleString()} teams · public board
            </span>
          )}
          <a href={KAGGLE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
            Kaggle <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
            {Array.from({ length: 9 }, (_, i) => <Skeleton key={i} className="h-[72px]" />)}
          </div>
          <Skeleton className="h-[380px]" />
        </div>
      )}
      {error && <p className="text-sm text-destructive">The leaderboard failed to load: {error.message}</p>}
      {isEmpty && <p className="text-sm text-muted-foreground">No leaderboard has been saved here yet.</p>}

      {model && (
        <>
          <BoardTiles model={model} />

          <Section title="Score by rank" note="Each dot is a team. The shaded bands are the medal zones on the public board right now.">
            <ScoreByRankChart model={model} />
          </Section>

          <Section title="Today so far" note="The board now against where it stood at the end of the previous day (UTC).">
            <TodayRecap model={model} />
          </Section>

          <div className="grid gap-3 xl:grid-cols-2">
            <Section title="Teams we are watching" note="Star any team in the table to add it. Stars are kept in this browser.">
              <WatchlistChart model={model} ids={watch.ids} onRemove={watch.toggle} />
            </Section>
            <Section title="The race over time" note="Leader, the three medal lines and our score. The dashed line is the close, 2 November.">
              <RaceChart model={model} />
            </Section>
          </div>

          <Section title="Recent moves">
            <MovesFeed model={model} />
          </Section>

          <Section title="All teams">
            <TeamsTable model={model} watched={watch.ids} onToggleWatch={watch.toggle} />
          </Section>

          <p className="text-xs text-muted-foreground">
            Read from Kaggle's public leaderboard every half hour. Days before our own saves began come from the public
            history kept at arc3.huikang.dev (one point a day, so a little approximate). Medal lines follow Kaggle's usual
            rule: gold is the top ten plus a fifth of a percent of teams, silver the top five percent, bronze the top ten
            percent. Medals are settled on the private board at the close, so this is a standing, not a result.
          </p>
        </>
      )}
    </div>
  );
}
