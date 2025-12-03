/**
 * Author: Codex / GPT-5
 * Date: 2025-11-30
 * PURPOSE: Compose the primary Poetiq transparency UI. Presents phases, experts,
 *          and token metrics so the run feels fully narrated to the user.
 * SRP/DRY check: Pass - orchestration layer that delegates to child SRP components.
 */

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Download, Info } from 'lucide-react';
import type { PoetiqProgressState, PoetiqRawEvent } from '@/hooks/usePoetiqProgress';
import PoetiqPhaseIndicator from './PoetiqPhaseIndicator';
import PoetiqExpertTracker from './PoetiqExpertTracker';

interface PoetiqProgressDashboardProps {
  state: PoetiqProgressState;
  rawEvents?: PoetiqRawEvent[];
}

const formatPercent = (value?: number) => {
  if (value === undefined || Number.isNaN(value)) return '-';
  return `${Math.round(value * 100)}%`;
};

const formatCount = (value?: number) => {
  if (!value) return '0';
  return value.toLocaleString();
};

export function PoetiqProgressDashboard({ state, rawEvents }: PoetiqProgressDashboardProps) {
  const totalIterations = state.totalIterations ?? state.config?.maxIterations ?? 10;
  const iterationHistory = state.iterationHistory ?? [];
  const latestIteration = iterationHistory.length > 0 ? iterationHistory[iterationHistory.length - 1] : null;
  const bestIteration = useMemo(() => {
    if (!iterationHistory.length) return null;
    return iterationHistory.reduce((best, entry) => {
      if (!best || (entry.accuracy ?? 0) > (best.accuracy ?? 0)) {
        return entry;
      }
      return best;
    }, iterationHistory[0]);
  }, [iterationHistory]);

  const summary = useMemo(() => {
    const attempts = iterationHistory.length;
    const expertsInPlay =
      (state.config?.numExperts ?? Object.keys(state.expertStates ?? {}).length) || 1;
    const passCount = bestIteration?.passCount ?? 0;
    const totalChecked = (bestIteration?.passCount ?? 0) + (bestIteration?.failCount ?? 0);
    const bestExpert = bestIteration?.expert;
    const solvedExamples = `${passCount}/${totalChecked || '0'}`;
    const runStatus =
      state.status === 'completed'
        ? state.result?.isPredictionCorrect
          ? 'Solved the hidden test as well.'
          : 'Found a rule but the hidden test disagreed.'
        : state.status === 'error'
          ? 'Run ended with an error.'
          : 'Still testing ideas.';
    return {
      attempts,
      expertsInPlay,
      solvedExamples,
      bestExpert,
      runStatus,
    };
  }, [bestIteration, iterationHistory.length, state.config?.numExperts, state.result?.isPredictionCorrect, state.status]);

  const recap = useMemo(() => {
    const finished = state.status === 'completed' || state.status === 'error';
    if (!finished) return null;
    const bestAccuracy = typeof bestIteration?.accuracy === 'number'
      ? `${Math.round((bestIteration.accuracy ?? 0) * 100)}%`
      : 'unknown';
    const winningExpert = bestIteration?.expert ?? null;
    const consensusExperts = new Set<number>();
    if (typeof bestIteration?.accuracy === 'number') {
      iterationHistory.forEach((entry) => {
        if (entry.accuracy === bestIteration?.accuracy && typeof entry.expert === 'number') {
          consensusExperts.add(entry.expert);
        }
      });
    }
    const consensusCount = consensusExperts.size || (winningExpert ? 1 : 0);
    return {
      finished,
      winningExpert,
      bestAccuracy,
      consensusCount,
      solvedHidden: state.result?.isPredictionCorrect ?? false,
      totalAttempts: iterationHistory.length,
      durationMs: state.result?.elapsedMs ?? null,
    };
  }, [bestIteration, iterationHistory, state.result?.elapsedMs, state.result?.isPredictionCorrect, state.status]);

  const handleExport = () => {
    if (!rawEvents || rawEvents.length === 0) return;
    const text = rawEvents
      .map((evt) => `${evt.timestamp} | ${evt.type} | ${evt.phase ?? 'n/a'} | ${JSON.stringify(evt.payload)}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `poetiq-run-${new Date().toISOString().slice(0, 19)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (state.status === 'idle') {
    return (
      <Card className="border border-dashed border-gray-300">
        <CardHeader>
          <CardTitle className="text-sm text-gray-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-gray-500" />
            Solver status
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-gray-600">
          Start a Poetiq run to see phase, expert, and token insights populate here in real time.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border border-blue-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-blue-900 flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-600" />
            What the AI agents are doing right now
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-900 space-y-2">
          <p>
            We run <strong>{summary.expertsInPlay}</strong> parallel Poetiq agents. Each agent is just one AI call trying
            to write a <code>transform()</code> function that turns the input grid into the output grid.
          </p>
            <p>
              They are currently on <strong>iteration {state.iteration ?? 0}</strong> (out of {totalIterations}). An
              iteration means "write code {'->'} test it on the training grids {'->'} read the feedback we gave {'->'} try again."
            </p>
          <p>
            When two or more agents reach the exact same hidden-test answer, we treat that agreement as a stronger vote of
            confidence.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <PoetiqPhaseIndicator
          currentPhase={state.phase}
          iteration={state.iteration}
          totalIterations={totalIterations}
          phaseStartedAt={state.phaseStartedAt}
          phaseHistory={state.phaseHistory}
          status={state.status}
          message={state.message}
        />
        <PoetiqExpertTracker
          expertStates={state.expertStates}
          maxIterations={totalIterations}
          activeExpert={state.expert}
        />
      </div>
      <Card className="border border-emerald-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-emerald-900 flex items-center gap-2">
            Iteration Snapshot
            {latestIteration && (
              <Badge variant="secondary" className="text-[10px]">
                Iter {latestIteration.iteration} / Expert {latestIteration.expert ?? '-'}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-emerald-900">
          {latestIteration ? (
            <>
              <p>
                Current accuracy: <strong>{formatPercent(latestIteration.accuracy)}</strong>
              </p>
              <p>
                Pass count: {latestIteration.passCount ?? 0} /{' '}
                {(latestIteration.passCount ?? 0) + (latestIteration.failCount ?? 0)}
              </p>
              {state.message && (
                <p className="text-emerald-800">Latest message: {state.message}</p>
              )}
            </>
          ) : (
            <p>No iteration results yet. Waiting for first sandbox execution.</p>
          )}
          {bestIteration && (
            <div className="rounded border border-emerald-100 bg-emerald-50 p-2 text-emerald-800">
              <p className="font-semibold text-[11px] uppercase">Best progress so far</p>
              <p>
                {formatPercent(bestIteration.accuracy)} accuracy from iteration {bestIteration.iteration}{' '}
                (Expert {bestIteration.expert ?? '-'})
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-slate-200">
        <CardHeader className="pb-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-base text-slate-900">
            <AlertCircle className="h-4 w-4 text-slate-600" />
            Plain-language run summary
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleExport}
            disabled={!rawEvents || rawEvents.length === 0}
            title="Download every event from this run"
            className="flex items-center gap-1"
          >
            <Download className="h-3.5 w-3.5" />
            Export run transcript
          </Button>
        </CardHeader>
        <CardContent className="text-sm text-slate-800 space-y-2">
          <p>
            - Tried <strong>{formatCount(summary.attempts)}</strong> code ideas across{' '}
            <strong>{formatCount(summary.expertsInPlay)}</strong> Poetiq agents (each agent = one AI call).
          </p>
          <p>
            - Best idea so far came from{' '}
            <strong>
              {summary.bestExpert !== undefined ? `Agent ${summary.bestExpert}` : 'one of the agents still running'}
            </strong>{' '}
            and passes {summary.solvedExamples} training examples.
          </p>
          <p>- Current verdict: {summary.runStatus}</p>
          <p className="text-slate-600 italic">
            If you see "Waiting" or "...", that means we don't have that measurement yet. These numbers update live as
            soon as the agents report back.
          </p>
        </CardContent>
      </Card>

      {recap && (
        <Card className="border border-emerald-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-emerald-900">Run recap (after completion)</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-emerald-900 space-y-1">
            <p>
              - Tried <strong>{recap.totalAttempts}</strong> total iterations across{' '}
              <strong>{summary.expertsInPlay}</strong> experts.
            </p>
            <p>
              - Best idea came from{' '}
              <strong>
                {recap.winningExpert !== null ? `Expert ${recap.winningExpert}` : 'one of the experts'}
              </strong>{' '}
              and hit <strong>{recap.bestAccuracy}</strong> accuracy on the training examples.
            </p>
            <p>
              - {recap.consensusCount > 1
                ? `${recap.consensusCount} experts converged on this same approach, which boosted our confidence.`
                : 'Only one expert reached that score; future runs may try more iterations or different models.'}
            </p>
            <p>
              - Hidden test verdict: <strong>{recap.solvedHidden ? 'Solved' : 'Not solved yet'}</strong>.
            </p>
            {recap.durationMs && (
              <p>
                - Total runtime: <strong>{Math.round(recap.durationMs / 1000)} seconds</strong>.
              </p>
            )}
            <p className="text-emerald-800">
              We've saved the winning program (and this recap) to your explanation library, so you can revisit the exact
              code whenever you need.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default PoetiqProgressDashboard;
