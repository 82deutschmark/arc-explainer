/**
 * Author: Codex / GPT-5
 * Date: 2025-11-30
 * PURPOSE: Compose the primary Poetiq transparency UI. Presents phases, experts,
 *          and token metrics so the run feels fully narrated to the user.
 * SRP/DRY check: Pass — orchestration layer that delegates to child SRP components.
 */

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Download, Info } from 'lucide-react';
import type { PoetiqProgressState, PoetiqRawEvent } from '@/hooks/usePoetiqProgress';
import PoetiqPhaseIndicator from './PoetiqPhaseIndicator';
import PoetiqExpertTracker from './PoetiqExpertTracker';
import PoetiqTokenMetrics from './PoetiqTokenMetrics';

interface PoetiqProgressDashboardProps {
  state: PoetiqProgressState;
  rawEvents?: PoetiqRawEvent[];
}

const formatPercent = (value?: number) => {
  if (value === undefined || Number.isNaN(value)) return '—';
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
          <CardTitle className="text-sm text-blue-900 flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-600" />
            What the AI team is doing right now
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-blue-900 space-y-1">
          <p>
            We’ve hired <strong>{summary.expertsInPlay}</strong> virtual coders. Each one is writing a Python rule,
            testing it on the sample puzzles, and revising it until the outputs match.
          </p>
          <p>
            Right now they are working on <strong>iteration {state.iteration ?? 0}</strong> out of an allowance of{' '}
            {totalIterations}. Whenever a coder’s program passes every sample, we stop and try their answer on the hidden
            test grid.
          </p>
          <p>
            When multiple coders end up with the same hidden-grid answer, we treat that as a “vote” and show it as the top
            recommendation.
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
      <div className="grid gap-4 lg:grid-cols-2">
        <PoetiqTokenMetrics
          tokenUsage={state.tokenUsage}
          cost={state.cost}
          expertStates={state.expertStates}
        />
        <Card className="border border-emerald-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-emerald-900 flex items-center gap-2">
              Iteration Snapshot
              {latestIteration && (
                <Badge variant="secondary" className="text-[10px]">
                  Iter {latestIteration.iteration} / Expert {latestIteration.expert ?? '—'}
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
                  (Expert {bestIteration.expert ?? '—'})
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border border-slate-200">
        <CardHeader className="pb-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-900">
            <AlertCircle className="h-4 w-4 text-slate-600" />
            Plain-language run summary
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={!rawEvents || rawEvents.length === 0}
            className={`flex items-center gap-1 rounded px-3 py-1 text-xs font-semibold ${
              rawEvents && rawEvents.length
                ? 'bg-slate-900 text-white hover:bg-slate-800'
                : 'bg-slate-200 text-slate-500 cursor-not-allowed'
            }`}
            title="Download every event from this run"
          >
            <Download className="h-3.5 w-3.5" />
            Export run transcript
          </button>
        </CardHeader>
        <CardContent className="text-xs text-slate-800 space-y-1">
          <p>
            • Tried <strong>{formatCount(summary.attempts)}</strong> code ideas across{' '}
            <strong>{formatCount(summary.expertsInPlay)}</strong> experts.
          </p>
          <p>
            • Best idea so far came from{' '}
            <strong>{summary.bestExpert !== undefined ? `Expert ${summary.bestExpert}` : 'an expert still working'}</strong>{' '}
            and passes {summary.solvedExamples} training examples.
          </p>
          <p>• Current verdict: {summary.runStatus}</p>
          <p className="text-slate-600">
            We keep the winning program (and a short history per expert) in your explanation database once the run ends,
            so you can always revisit the exact code we trusted.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default PoetiqProgressDashboard;
