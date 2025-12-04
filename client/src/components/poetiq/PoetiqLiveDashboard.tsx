/**
 * Author: Codex (GPT-5)
 * Date: 2025-12-03
 * PURPOSE: Minimal Poetiq telemetry header that only surfaces real-time metrics.
 *          Shows model, token usage, cost, phase, and iteration progress at a glance.
 * SRP/DRY check: Pass - focused solely on summary telemetry (no static story cards).
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Cpu, Coins, Layers, Timer } from 'lucide-react';
import type { PoetiqProgressState } from '@/hooks/usePoetiqProgress';

interface PoetiqLiveDashboardProps {
  state: PoetiqProgressState;
}

const formatTokens = (value?: number) => {
  if (!value) return '0';
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toString();
};

const formatCost = (value?: number) => {
  if (!value) return '$0.0000';
  return `$${value.toFixed(4)}`;
};

const formatElapsed = (ms?: number) => {
  if (!ms) return '…';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
};

export function PoetiqLiveDashboard({ state }: PoetiqLiveDashboardProps) {
  if (state.status === 'idle') {
    return null;
  }

  const totalIterations = state.totalIterations ?? state.config?.maxIterations ?? 10;
  const currentIteration = Math.min(state.iteration ?? 0, totalIterations);
  const progressPercent =
    totalIterations > 0 ? Math.round((currentIteration / totalIterations) * 100) : 0;
  const tokenUsage = state.tokenUsage ?? state.result?.tokenUsage ?? null;
  const costUsage = state.cost ?? state.result?.cost ?? null;
  const modelLabel =
    state.agentModel ||
    state.currentPromptData?.model ||
    state.config?.model ||
    'Model pending…';
  const providerLabel = state.currentPromptData?.provider || undefined;

  const statusBadge =
    state.status === 'completed'
      ? { label: 'DONE', variant: 'secondary' as const }
      : state.status === 'error'
        ? { label: 'ERROR', variant: 'destructive' as const }
        : { label: 'RUNNING', variant: 'default' as const };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
            {state.phase && (
              <span className="text-xs uppercase tracking-wide text-slate-500">
                {state.phase}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Cpu className="h-5 w-5 text-indigo-600" />
            {modelLabel}
          </div>
          {providerLabel && (
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Provider: {providerLabel}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-3 text-sm text-slate-600">
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Tokens in</div>
            <div className="font-mono text-base text-slate-900">
              {formatTokens(tokenUsage?.input_tokens ?? state.agentUsage?.inputTokens)}
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Tokens out</div>
            <div className="font-mono text-base text-slate-900">
              {formatTokens(tokenUsage?.output_tokens ?? state.agentUsage?.outputTokens)}
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Total tokens</div>
            <div className="font-mono text-base text-slate-900">
              {formatTokens(tokenUsage?.total_tokens ?? state.agentUsage?.totalTokens)}
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Total cost</div>
            <div className="flex items-center gap-1 font-mono text-base text-slate-900">
              <Coins className="h-4 w-4 text-amber-500" />
              {formatCost(costUsage?.total)}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600">
            <Layers className="h-4 w-4" />
            Iteration progress
          </div>
          <div className="mt-2 text-sm text-slate-700">
            Iter {currentIteration} / {totalIterations}
          </div>
          <Progress value={progressPercent} className="mt-2 h-2" />
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Timer className="h-4 w-4" />
            Elapsed
          </div>
          <div className="mt-2 text-lg font-mono text-slate-900">
            {formatElapsed(state.result?.elapsedMs)}
          </div>
          <p className="text-[11px] text-slate-500">Updates continuously during the run</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div className="text-xs font-semibold text-slate-600">Latest message</div>
          <p className="mt-2 line-clamp-3 text-sm text-slate-700">
            {state.message || 'Waiting for solver output…'}
          </p>
        </div>
      </div>
    </section>
  );
}

export default PoetiqLiveDashboard;
