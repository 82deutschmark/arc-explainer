/**
 * Author: Codex / GPT-5
 * Date: 2025-11-30
 * PURPOSE: Render per-expert progress (iteration, status, token/cost stats)
 *          so users can see how Poetiq's parallel experts are behaving.
 * SRP/DRY check: Pass — focused on expert cards, reuses shared UI primitives.
 */

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { User, Zap } from 'lucide-react';
import type { PoetiqExpertState } from '@/hooks/usePoetiqProgress';

interface PoetiqExpertTrackerProps {
  expertStates?: Record<string, PoetiqExpertState>;
  maxIterations: number;
  activeExpert?: number;
}

const statusStyles: Record<PoetiqExpertState['status'], string> = {
  idle: 'bg-gray-100 text-gray-700',
  initializing: 'bg-slate-100 text-slate-700',
  prompting: 'bg-sky-100 text-sky-700',
  evaluating: 'bg-amber-100 text-amber-700',
  feedback: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-emerald-100 text-emerald-700',
  error: 'bg-red-100 text-red-700',
};

const formatPercent = (value?: number) => {
  if (value === undefined || Number.isNaN(value)) return '—';
  return `${Math.round(value * 100)}%`;
};

const formatTokens = (value?: number) => {
  if (value === undefined) return '0';
  return value.toLocaleString();
};

const formatCost = (value?: number) => {
  if (value === undefined) return '$0.0000';
  return `$${value.toFixed(4)}`;
};

export function PoetiqExpertTracker({ expertStates, maxIterations, activeExpert }: PoetiqExpertTrackerProps) {
  const experts = useMemo(() => {
    if (!expertStates) return [];
    return Object.values(expertStates).sort((a, b) => a.expertId - b.expertId);
  }, [expertStates]);

  if (!experts.length) {
    return (
      <Card className="border border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm text-slate-800 flex items-center gap-2">
            <User className="h-4 w-4 text-slate-500" />
            Expert Tracker
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-slate-500">
          Waiting for experts to start their first iteration...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-slate-200">
      <CardHeader>
        <CardTitle className="text-sm text-slate-800 flex items-center gap-2">
          <User className="h-4 w-4 text-slate-600" />
          Expert Tracker
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {experts.map((expert) => {
          const progressValue = Math.min(100, Math.round(((expert.iteration ?? 0) / Math.max(1, maxIterations)) * 100));
          const badgeClass = statusStyles[expert.status] || statusStyles.idle;
          const isActive = activeExpert === expert.expertId;

          return (
            <div
              key={expert.expertId}
              className={`rounded border p-3 text-xs ${isActive ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-white'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 font-semibold text-slate-800">
                  <span>Expert {expert.expertId}</span>
                  {expert.trainAccuracy !== undefined && (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {formatPercent(expert.trainAccuracy)} train accuracy
                    </Badge>
                  )}
                </div>
                <Badge className={`text-[10px] font-medium ${badgeClass}`} variant="outline">
                  {expert.status.toUpperCase()}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1">
                <span>Iteration {expert.iteration ?? 0} / {maxIterations}</span>
                <span className="flex items-center gap-1 text-slate-500">
                  <Zap className="h-3.5 w-3.5" />
                  {expert.lastUpdated ? new Date(expert.lastUpdated).toLocaleTimeString() : '—'}
                </span>
              </div>
              <Progress value={progressValue} className="h-1.5 mb-2" />
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                <div>
                  <p className="font-semibold text-slate-700">Tokens</p>
                  <p>Input: {formatTokens(expert.tokens?.input_tokens)}</p>
                  <p>Output: {formatTokens(expert.tokens?.output_tokens)}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Cost</p>
                  <p>{formatCost(expert.cost?.total)}</p>
                  <p className="text-slate-500">
                    {expert.passCount ?? 0}/{(expert.passCount ?? 0) + (expert.failCount ?? 0)} examples passing
                  </p>
                </div>
              </div>
              {expert.lastMessage && (
                <p className="mt-2 text-[11px] text-slate-500 italic">
                  “{expert.lastMessage}”
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default PoetiqExpertTracker;
