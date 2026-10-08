/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-07
 * PURPOSE: Public page for the ARC Prize 2026 ARC-AGI-3 Kaggle leaderboard, at
 *          /kaggle-leaderboard. Every team on the public board, the medal cut lines, the pinned
 *          team always highlighted: the contested pack by rank, this week's storylines, where scores bunch up,
 *          today's movers, scores and the pinned rank over a chosen window, starred-team trails, a
 *          feed of score changes, and the full searchable table. Names link to Kaggle.
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

import { KAGGLE_COMPETITIONS, kaggleLeaderboardUrl, type KaggleCompetitionKey } from '@shared/kaggleCompetitions';
import { Link } from 'wouter';
import { useState, type ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageMeta } from '@/hooks/usePageMeta';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TIME_RANGES, ago, useKaggleBoard, type TimeRange } from '@/components/kaggleLeaderboard/boardData';
import { FeaturedTeams } from '@/components/kaggleLeaderboard/FeaturedTeams';
import { BoardTiles } from '@/components/kaggleLeaderboard/BoardTiles';
import { MedalRaceChart } from '@/components/kaggleLeaderboard/MedalRaceChart';
import { ScoreCrowdChart } from '@/components/kaggleLeaderboard/ScoreCrowdChart';
import { OurRankChart } from '@/components/kaggleLeaderboard/OurRankChart';
import { TodayRecap } from '@/components/kaggleLeaderboard/TodayRecap';
import { WatchlistChart } from '@/components/kaggleLeaderboard/WatchlistChart';
import { MovesFeed } from '@/components/kaggleLeaderboard/MovesFeed';
import { RaceChart } from '@/components/kaggleLeaderboard/RaceChart';
import { TeamsTable } from '@/components/kaggleLeaderboard/TeamsTable';
import { useWatchlist } from '@/components/kaggleLeaderboard/useWatchlist';
import { HeadlineFacts, StoryGrid } from '@/components/kaggleLeaderboard/Storylines';

function Section({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-3 pt-4">
        <CardTitle className="text-base">{title}</CardTitle>
        {note && <CardDescription className="text-xs">{note}</CardDescription>}
      </CardHeader>
      <CardContent className="pb-4">{children}</CardContent>
    </Card>
  );
}

export default function KaggleLeaderboard({ competitionKey = 'arc-3' }: { competitionKey?: KaggleCompetitionKey }) {
  const competition = KAGGLE_COMPETITIONS[competitionKey];
  usePageMeta({
    // Matches the server-rendered entry in shared/routes.ts.
    title: `ARC Prize 2026 ${competition.label} Kaggle Leaderboard: Live Standings & History`,
    description:
      `Every team on the ${competition.label} Kaggle public leaderboard, saved every half hour: medal lines, `
      + 'who is climbing, who is sinking, score history and the race to the close.',
    canonicalPath: competition.path,
  });

  const { model, isLoading, error, isEmpty } = useKaggleBoard(competition);
  const watch = useWatchlist(model, competition.slug);
  const [range, setRange] = useState<TimeRange>(competitionKey === 'arc-3' ? 'since-aug' : 'all');
  const hasWeek = !!model?.history.snaps.some((s) => Date.parse(s.t) <= Date.parse(model.latest.fetched) - 7 * 864e5);

  return (
    <div className="kaggle-lb mx-auto max-w-[1400px] space-y-3 px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-xl font-semibold">{competition.label} Kaggle leaderboard</h1>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {model && (
            <span>
              Saved {ago(model.latest.fetched)} · {model.latest.teams.toLocaleString()} teams · public board
            </span>
          )}
          <a href={kaggleLeaderboardUrl(competition)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
            Kaggle <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <nav aria-label="Kaggle competition" className="flex gap-2 text-sm">
        {Object.values(KAGGLE_COMPETITIONS).map((c) => (
          <Link key={c.slug} href={c.path} aria-current={c.slug === competition.slug ? 'page' : undefined} className={`rounded border px-3 py-1.5 ${c.slug === competition.slug ? 'border-primary bg-primary/10 font-semibold text-primary' : 'text-muted-foreground hover:text-foreground'}`}>{c.label}</Link>
        ))}
      </nav>

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

          <Section title="Competitor cards" note="The leaders and familiar contenders. Today’s changes compare with the previous UTC day’s close; each score trail has its own scale.">
            <FeaturedTeams model={model} watched={watch.ids} onToggleWatch={watch.toggle} />
          </Section>

          <Section
            title="The race for medals"
            note="Start at the gold cutoff, then widen the view. These are public-board standings; final medals are decided on the private board."
          >
            <MedalRaceChart model={model} />
          </Section>

          <Section title="This week's storylines" note="Who is rocketing up, who is sinking, who is grinding, and who is one submission from gold.">
            {hasWeek ? <>
              <HeadlineFacts model={model} />
              <div className="mt-6"><StoryGrid model={model} /></div>
            </> : <p className="text-sm text-muted-foreground">Weekly comparisons will appear after a week of saved history. No earlier standings have been reconstructed.</p>}
          </Section>

          <div className="grid gap-3 xl:grid-cols-[3fr_2fr]">
            <Section title="Where the scores bunch up" note="Teams at each score, coloured by the medal zone that score earns. A tall column means a small gain passes many teams.">
              <ScoreCrowdChart model={model} />
            </Section>
            <Section title="Today so far" note="The board now against where it stood at the end of the previous day (UTC).">
              {model.latest.rows.some((r) => r[7] != null) ? <TodayRecap model={model} /> : <p className="text-sm text-muted-foreground">Daily changes will appear once a previous-day snapshot is available.</p>}
            </Section>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <h2 className="text-base font-semibold">Over time</h2>
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={range}
              onValueChange={(v) => v && setRange(v as TimeRange)}
              aria-label="Time window for the charts below"
            >
              {TIME_RANGES.map(([value, label]) => (
                <ToggleGroupItem key={value} value={value} className="h-7 px-2.5 text-xs">{label}</ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <Section title="Scores over time" note={`The leader and three medal lines${model.ourRow ? ", with the pinned team’s score" : ""}.${competition.closeAt ? ` Grey runs to the close on ${new Date(competition.closeAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })}.` : ""}`}>
              <RaceChart model={model} range={range} />
            </Section>
            {model.ourRow && <Section title="Pinned team against the medal cut-offs" note="Rank 1 at the top. The zones shift down as more teams join, since each medal is a share of the field.">
              <OurRankChart model={model} range={range} />
            </Section>}
          </div>

          <Section title="Watchlist" note="Star any team in the table or cards to add it. Pins stay visible; other stars are kept in this browser for each competition.">
            <WatchlistChart model={model} ids={watch.ids} range={range} onRemove={watch.toggle} />
          </Section>

          <Section title="Recent moves">
            <MovesFeed model={model} />
          </Section>

          <Section title="All teams" note="Team names open the first member's Kaggle profile; every member name links to its own.">
            <TeamsTable model={model} watched={watch.ids} onToggleWatch={watch.toggle} />
          </Section>

          <p className="text-xs text-muted-foreground">
            Read from Kaggle's public leaderboard every half hour.
            {competition.backfillSource ? <> Earlier history comes from {competition.backfillSource} (one point a day, so a little approximate).</> : <> History starts with the first saved snapshot; earlier moves are unavailable.</>}
            {' '}Medal lines follow Kaggle's usual
            rule: gold is the top ten plus a fifth of a percent of teams, silver the top five percent, bronze the top ten
            percent. Medals are settled on the private board at the close, so this is a standing, not a result.
          </p>
        </>
      )}
    </div>
  );
}
