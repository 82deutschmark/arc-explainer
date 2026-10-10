/**
 * Author: Claude Sonnet 5.5
 * Date: 10-October-2026
 * PURPOSE: /arc-leaderboards, the one page that answers a search for "ARC leaderboards": the top of
 *          both live ARC Prize 2026 Kaggle boards (ARC-AGI-3 and ARC-AGI-2) read from the saved
 *          board digest, with a link into each full board, and a short list of the other ARC
 *          leaderboards (the official ARC Prize board, the archived model results, the ARC Daily
 *          Digest). Crawler text for the same page is in shared/routes.ts and
 *          server/services/seo/leaderboardSeo.ts; this is what the browser shows once the app loads.
 * SRP/DRY check: Pass — composition only. Standings come from the digest hook the ARC Daily front
 *          page already uses (useMarkets); the full boards stay on /kaggle-leaderboard, which this
 *          page links to rather than repeating. Unrelated to pages/Leaderboards.tsx (retired
 *          model rankings, kept only as a 410 notice for old bookmarks).
 */
import { Link } from 'wouter';
import { ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePageMeta } from '@/hooks/usePageMeta';
import { ago } from '@/components/kaggleLeaderboard/boardData';
import { BOARD_ORDER, useMarkets } from '@/components/news/NewsMarkets';
import { KAGGLE_COMPETITIONS } from '@shared/kaggleCompetitions';
import type { MarketBoard } from '@shared/newsMarkets';

const TOP = 10;

function BoardCard({ board, loading }: { board?: MarketBoard; loading: boolean }) {
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-3 pt-4">
        <CardTitle className="text-base">
          <Link href={board?.boardPath ?? '/kaggle-leaderboard'} className="underline-offset-4 hover:underline">{board?.label ?? 'ARC-AGI'} leaderboard</Link>
        </CardTitle>
        <CardDescription className="text-xs">
          {board ? `Top ${Math.min(TOP, board.standings.length)} of ${board.teams} teams · saved ${ago(board.fetched)}` : loading ? 'Loading the saved board' : 'Standings are not available right now'}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        {board ? (
          <Table>
            <TableHeader>
              <TableRow><TableHead className="w-14">Rank</TableHead><TableHead>Team</TableHead><TableHead className="text-right">Score</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {board.standings.slice(0, TOP).map((row) => (
                <TableRow key={row.teamId}>
                  <TableCell className="tabular-nums">{row.rank}</TableCell>
                  <TableCell className="max-w-[16rem] truncate">{row.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.score.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : loading ? <Skeleton className="h-48 w-full" /> : null}
        <p className="mt-3 text-sm">
          <Link href={board?.boardPath ?? '/kaggle-leaderboard'} className="underline underline-offset-4">Full leaderboard with medal lines, movers and history</Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function ArcLeaderboards() {
  usePageMeta({ canonicalPath: '/arc-leaderboards' });
  const markets = useMarkets();
  return (
    <section className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">ARC leaderboards</h1>
        <p className="max-w-3xl text-muted-foreground">
          Every ARC leaderboard in one place. The two live boards are the ARC Prize 2026 Kaggle competitions, ARC-AGI-3 and ARC-AGI-2:
          every team's rank and score, read from the public Kaggle leaderboard and saved every half hour. Public standings are not final private results;
          medals are settled on the private board at the close.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {BOARD_ORDER.map((key) => (
          <BoardCard key={key} board={markets.data?.boards[key]} loading={markets.isLoading} />
        ))}
      </div>
      <Card>
        <CardHeader className="pb-3 pt-4"><CardTitle className="text-base">Other ARC leaderboards</CardTitle></CardHeader>
        <CardContent className="space-y-3 pb-4 text-sm">
          <ul className="space-y-3">
            <li>
              <a className="inline-flex items-center gap-1 font-medium underline underline-offset-4" href="https://arcprize.org/leaderboard" target="_blank" rel="noreferrer">
                ARC Prize leaderboard <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
              <span className="text-muted-foreground"> — the official leaderboard at arcprize.org.</span>
            </li>
            {BOARD_ORDER.map((key) => (
              <li key={key}>
                <a className="inline-flex items-center gap-1 font-medium underline underline-offset-4" href={`https://www.kaggle.com/competitions/${KAGGLE_COMPETITIONS[key].slug}/leaderboard`} target="_blank" rel="noreferrer">
                  {KAGGLE_COMPETITIONS[key].label} on Kaggle <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
                <span className="text-muted-foreground"> — the source board our saved copy is read from.</span>
              </li>
            ))}
            <li>
              <Link className="font-medium underline underline-offset-4" href="/analytics">ARC-AGI-1 and ARC-AGI-2 model results (archive)</Link>
              <span className="text-muted-foreground"> — imported ARC Prize evaluation results, kept as a dated archive.</span>
            </li>
            <li>
              <Link className="font-medium underline underline-offset-4" href="/news">The ARC Daily Digest</Link>
              <span className="text-muted-foreground"> — daily reporting on both Kaggle boards.</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
