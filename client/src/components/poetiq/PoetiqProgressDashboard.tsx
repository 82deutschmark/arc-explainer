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
import { AlertCircle } from 'lucide-react';
import type { PoetiqProgressState } from '@/hooks/usePoetiqProgress';
import PoetiqPhaseIndicator from './PoetiqPhaseIndicator';
import PoetiqExpertTracker from './PoetiqExpertTracker';
import PoetiqTokenMetrics from './PoetiqTokenMetrics';

interface PoetiqProgressDashboardProps {
  state: PoetiqProgressState;
}

const formatPercent = (value?: number) => {
  if (value === undefined || Number.isNaN(value)) return '—';
  return `${Math.round(value * 100)}%`;
};

export function PoetiqProgressDashboard({ state }: PoetiqProgressDashboardProps) {
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
    </div>
  );
}

export default PoetiqProgressDashboard;
