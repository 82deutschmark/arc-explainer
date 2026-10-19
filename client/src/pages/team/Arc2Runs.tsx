/**
 * Author: Claude Opus 5.5 Low
 * Date: 2026-10-19
 * PURPOSE: /team/arc2-runs, the team-only record of every ARC-AGI-2 Kaggle submission by team
 *          ARC Mutants (Son's ask, 19-Oct-2026; built after the ARC-3 "Kaggle runs record" on
 *          arc3.sonpham.net). One ruled table, newest first: when, who, the submitter's own
 *          description of the change, the public score, the run it's judged against and the
 *          difference, and whether Claude's note is in. Each row opens the run's page.
 *
 *          The submitter's words come first and are never rewritten; Claude's note is
 *          commentary on the run page beneath them. Scores are the public board's; medals are
 *          settled on the private board.
 * SRP/DRY check: Pass - list view only; data and the baseline rule in
 *          components/teamRuns/teamRunsApi.ts, one run in Arc2Run.tsx. shadcn Table/Button.
 */

import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePageMeta } from '@/hooks/usePageMeta';
import {
  SignInRequired, deltaText, effectiveBaseline, scoreText, useArc2Runs, useSignInRedirect, useSignOut, utcStamp, type RunRow,
} from '@/components/teamRuns/teamRunsApi';

function noteState(run: RunRow, baselineKey: string | null): string {
  const s = run.summary;
  if (!s || !s.state) return '—';
  if (s.state === 'done') return s.baselineKey === baselineKey ? 'in' : 'redoing';
  if (s.state === 'failed') return 'failed';
  return 'waiting';
}

export default function Arc2Runs() {
  usePageMeta({ title: 'ARC-AGI-2 runs (team)', description: 'Team-only record of ARC Mutants submissions.', noindex: true });
  const runs = useArc2Runs();
  const signOut = useSignOut();
  useSignInRedirect(runs.error);

  const rows = runs.data?.runs ?? [];
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const best = rows.reduce<RunRow | null>((a, r) => (r.publicScore != null && (!a || r.publicScore > (a.publicScore ?? -1)) ? r : a), null);

  return (
    <div className="max-w-[1180px] mx-auto px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-1">
        <h1 className="text-2xl font-bold">ARC-AGI-2 runs</h1>
        <Button variant="ghost" size="sm" onClick={() => signOut.mutate(undefined, { onSuccess: () => { window.location.href = '/team/login'; } })}>
          Sign out
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-6 max-w-[760px]">
        Every ARC Mutants submission on Kaggle, newest first, in the submitter's own words. Scores are
        the public leaderboard's. Open a run for the code changes against its baseline, the run
        log, and Claude's read of both. Team only.
        {best && <> Best so far: <b className="text-foreground">{scoreText(best.publicScore)}</b>, {best.who}, {utcStamp(best.submittedAt)}.</>}
      </p>

      {runs.isLoading && <Skeleton className="h-[480px] w-full" />}
      {runs.error && !(runs.error instanceof SignInRequired) && (
        <p className="text-sm text-destructive">The runs didn't load: {runs.error.message}</p>
      )}
      {runs.data && rows.length === 0 && <p className="text-sm">No runs published yet. The Mac Mini publishes every fifteen minutes.</p>}

      {rows.length > 0 && (
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[118px]">Submitted</TableHead>
              <TableHead className="w-[90px]">Who</TableHead>
              <TableHead>The change, in their words</TableHead>
              <TableHead className="w-[64px] text-right">Score</TableHead>
              <TableHead className="w-[130px]">Against</TableHead>
              <TableHead className="w-[70px]">Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((run) => {
              const base = effectiveBaseline(run.proposedBaseline, run.note);
              const baseRun = base.key ? byKey.get(base.key) : undefined;
              const delta = deltaText(run.publicScore, baseRun?.publicScore ?? null);
              return (
                <TableRow key={run.key} className="align-top">
                  <TableCell className="whitespace-nowrap tabular-nums">{utcStamp(run.submittedAt)}</TableCell>
                  <TableCell>{run.who}</TableCell>
                  <TableCell>
                    <Link href={`/team/arc2-runs/${run.key}`} className="hover:underline">
                      <span className="line-clamp-3">{run.description || '(no description on Kaggle)'}</span>
                    </Link>
                    {run.note?.note && <div className="mt-1 text-muted-foreground line-clamp-2">Team note: {run.note.note}</div>}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {run.status === 'complete' ? scoreText(run.publicScore) : run.status}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {baseRun ? (
                      <span title={base.why}>
                        {delta && <b className={delta.startsWith('+') ? 'text-green-700 dark:text-green-400' : delta.startsWith('−') ? 'text-red-700 dark:text-red-400' : ''}>{delta}</b>}
                        <span className="text-muted-foreground"> vs {scoreText(baseRun.publicScore)}</span>
                        {!run.note?.baseline && <span className="text-muted-foreground"> (guess)</span>}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">none</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{noteState(run, base.key)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
