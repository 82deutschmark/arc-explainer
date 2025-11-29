/**
 * Author: Codex / GPT-5
 * Date: 2025-11-30
 * PURPOSE: Visual indicator for the Poetiq solver phases (initializing, prompting,
 *          evaluating, feedback) with live timers so humans understand what the
 *          backend is doing at any moment.
 * SRP/DRY check: Pass - dedicated to rendering the phase timeline; consumes hook data.
 */

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Activity, Timer } from 'lucide-react';
import type { PhaseHistoryEntry } from '@/hooks/usePoetiqProgress';

const PHASE_STEPS = [
  { key: 'initializing', label: 'Initializing', description: 'Warming up experts & sandbox' },
  { key: 'prompting', label: 'Prompting', description: 'Sending instructions to the LLM' },
  { key: 'evaluating', label: 'Evaluating Code', description: 'Running generated Python against train data' },
  { key: 'feedback', label: 'Feedback Loop', description: 'Analyzing failures to guide the next attempt' },
];

export interface PoetiqPhaseIndicatorProps {
  currentPhase?: string;
  iteration?: number;
  totalIterations?: number;
  phaseStartedAt?: string;
  phaseHistory?: PhaseHistoryEntry[];
  status?: 'idle' | 'running' | 'completed' | 'error';
  message?: string;
}

const normalizePhaseKey = (raw?: string): string => {
  if (!raw) return '';
  const value = raw.toLowerCase();
  if (value.includes('init') || value.includes('solver')) return 'initializing';
  if (value.includes('prompt') || value.includes('reason')) return 'prompting';
  if (value.includes('evaluat') || value.includes('python')) return 'evaluating';
  if (value.includes('feedback')) return 'feedback';
  return value;
};

const formatElapsedFrom = (iso?: string) => {
  if (!iso) return '0s';
  const start = new Date(iso).getTime();
  if (Number.isNaN(start)) return '0s';
  const elapsedMs = Date.now() - start;
  if (elapsedMs < 0) return '0s';
  const seconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
};

const formatDurationMs = (durationMs?: number) => {
  if (durationMs === undefined || Number.isNaN(durationMs)) return '0s';
  const seconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
};

export function PoetiqPhaseIndicator({
  currentPhase,
  iteration,
  totalIterations,
  phaseStartedAt,
  phaseHistory,
  status,
  message,
}: PoetiqPhaseIndicatorProps) {
  const normalizedPhase = normalizePhaseKey(currentPhase);
  const completedKeys = useMemo(() => {
    const entries = phaseHistory ?? [];
    return new Set(
      entries
        .filter((entry) => entry.endedAt)
        .map((entry) => normalizePhaseKey(entry.phase))
    );
  }, [phaseHistory]);

  const recentHistory = useMemo(() => {
    if (!phaseHistory || phaseHistory.length === 0) return [];
    return [...phaseHistory].slice(-4).reverse();
  }, [phaseHistory]);

  return (
    <Card className="border border-indigo-200">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-semibold text-indigo-900">
          <span className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-indigo-600" />
            Live Phase Timeline
          </span>
          <Badge variant={status === 'completed' ? 'secondary' : status === 'error' ? 'destructive' : 'outline'}>
            {status?.toUpperCase() ?? 'IDLE'}
          </Badge>
        </CardTitle>
        <div className="text-xs text-gray-600 flex items-center flex-wrap gap-2">
          <span>Iteration {iteration ?? 0} / {totalIterations ?? 10}</span>
          <span className="flex items-center gap-1 text-indigo-700">
            <Timer className="h-3.5 w-3.5" />
            {formatElapsedFrom(phaseStartedAt)} in current phase
          </span>
        </div>
        {message && <p className="text-xs text-gray-500 mt-1">{message}</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 md:grid-cols-4">
          {PHASE_STEPS.map((step) => {
            const isActive = normalizedPhase === step.key;
            const isComplete = completedKeys.has(step.key);
            const value = isComplete ? 100 : isActive ? 66 : 20;
            return (
              <div
                key={step.key}
                className={`rounded border p-2 text-xs ${isActive ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-gray-800">{step.label}</span>
                  <Badge
                    variant={isComplete ? 'secondary' : isActive ? 'default' : 'outline'}
                    className="text-[10px] px-1"
                  >
                    {isComplete ? 'Done' : isActive ? 'Live' : 'Waiting'}
                  </Badge>
                </div>
                <Progress value={value} className="h-1.5 mb-1" />
                <p className="text-[11px] text-gray-600">{step.description}</p>
              </div>
            );
          })}
        </div>
        <div className="text-xs text-gray-600 space-y-1">
          <p className="font-semibold text-gray-700">Recent Phase Activity</p>
          {recentHistory.length === 0 ? (
            <p className="text-gray-500">Waiting for solver activity...</p>
          ) : (
            recentHistory.map((entry, idx) => (
              <div key={`${entry.startedAt}-${idx}`} className="flex flex-col rounded border border-gray-100 bg-gray-50 p-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-gray-700">
                    {entry.phase} {entry.iteration !== undefined ? `(Iter ${entry.iteration})` : ''}
                  </span>
                  <span className="text-gray-500">{entry.expert ? `Expert ${entry.expert}` : 'All experts'}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-gray-500">
                  <span>{new Date(entry.startedAt).toLocaleTimeString()}</span>
                  <span>
                    {entry.endedAt
                      ? formatDurationMs(entry.durationMs)
                      : `${formatElapsedFrom(entry.startedAt)} elapsed`}
                  </span>
                </div>
                {entry.message && <p className="text-[11px] text-gray-600 mt-1">{entry.message}</p>}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default PoetiqPhaseIndicator;
