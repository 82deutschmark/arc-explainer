/**
 * Author: Cascade
 * Date: 2025-12-03
 * PURPOSE: Compact, live Poetiq solver dashboard showing real-time metrics.
 *          Replaces PoetiqProgressDashboard with data-dense layout.
 *          No static explanatory text - just live data.
 * SRP/DRY check: Pass - focused on live metrics visualization.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Activity, 
  Cpu, 
  DollarSign, 
  Zap, 
  Clock, 
  CheckCircle, 
  XCircle,
  Code2,
  Brain,
  Timer,
  TrendingUp
} from 'lucide-react';
import type { PoetiqProgressState, PoetiqRawEvent } from '@/hooks/usePoetiqProgress';

interface PoetiqLiveDashboardProps {
  state: PoetiqProgressState;
  rawEvents?: PoetiqRawEvent[];
}

const formatCost = (cost?: number) => {
  if (!cost) return '$0.00';
  return `$${cost.toFixed(4)}`;
};

const formatTokens = (tokens?: number) => {
  if (!tokens) return '0';
  if (tokens > 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return tokens.toString();
};

const formatTime = (ms?: number) => {
  if (!ms) return '0s';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

export function PoetiqLiveDashboard({ state, rawEvents }: PoetiqLiveDashboardProps) {
  const experts = useMemo(() => {
    if (!state.expertStates) return [];
    return Object.values(state.expertStates).sort((a, b) => a.expertId - b.expertId);
  }, [state.expertStates]);

  const totalIterations = state.totalIterations ?? state.config?.maxIterations ?? 10;
  const currentIteration = state.iteration ?? 0;
  const progressPercent = Math.round((currentIteration / totalIterations) * 100);

  const globalCost = state.cost?.total ?? 0;
  const globalTokens = state.tokenUsage?.total_tokens ?? 0;
  
  const iterationHistory = state.iterationHistory ?? [];
  const bestIteration = useMemo(() => {
    if (!iterationHistory.length) return null;
    return iterationHistory.reduce((best, entry) => {
      if (!best || (entry.accuracy ?? 0) > (best.accuracy ?? 0)) return entry;
      return best;
    }, iterationHistory[0]);
  }, [iterationHistory]);

  const statusColor = state.status === 'completed' 
    ? 'bg-green-500' 
    : state.status === 'error' 
      ? 'bg-red-500' 
      : 'bg-blue-500';

  const statusText = state.status === 'completed' 
    ? 'DONE' 
    : state.status === 'error' 
      ? 'ERROR' 
      : 'RUNNING';

  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [state.logLines?.length]);

  if (state.status === 'idle') {
    return null; // Don't show anything when idle
  }

  return (
    <div className="space-y-3">
      {/* Compact Header Bar */}
      <div className="flex items-center justify-between rounded-lg border bg-slate-50 px-4 py-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${statusColor} ${state.status === 'running' ? 'animate-pulse' : ''}`} />
            <span className="text-sm font-semibold">{statusText}</span>
          </div>
          <Badge variant="outline" className="text-xs">
            <Clock className="mr-1 h-3 w-3" />
            {state.phase || 'initializing'}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            Iter {currentIteration}/{totalIterations}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {formatTokens(globalTokens)} tokens
          </span>
          <span className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            {formatCost(globalCost)}
          </span>
          {state.result?.elapsedMs && (
            <span className="flex items-center gap-1">
              <Timer className="h-3 w-3" />
              {formatTime(state.result.elapsedMs)}
            </span>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-3 lg:grid-cols-3">
        {/* Expert Progress Cards */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Cpu className="h-4 w-4" />
              Experts ({experts.length || state.config?.numExperts || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {experts.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Activity className="h-4 w-4 animate-pulse" />
                Initializing experts...
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {experts.map((expert) => {
                  const expertProgress = Math.round(((expert.iteration ?? 0) / totalIterations) * 100);
                  const isActive = state.expert === expert.expertId;
                  const accuracy = expert.trainAccuracy !== undefined 
                    ? Math.round(expert.trainAccuracy * 100) 
                    : null;
                  
                  return (
                    <div
                      key={expert.expertId}
                      className={`rounded border p-2 text-xs ${
                        isActive ? 'border-blue-400 bg-blue-50' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold">Expert {expert.expertId}</span>
                        <Badge 
                          variant={expert.status === 'completed' ? 'secondary' : 'outline'} 
                          className="text-[10px] px-1"
                        >
                          {expert.status}
                        </Badge>
                      </div>
                      <Progress value={expertProgress} className="h-1 mb-1" />
                      <div className="flex items-center justify-between text-slate-500">
                        <span>Iter {expert.iteration ?? 0}</span>
                        {accuracy !== null && (
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {accuracy}%
                          </span>
                        )}
                        {expert.cost?.total && (
                          <span>{formatCost(expert.cost.total)}</span>
                        )}
                      </div>
                      {expert.passCount !== undefined && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-3 w-3" />
                            {expert.passCount}
                          </span>
                          <span className="flex items-center gap-1 text-red-600">
                            <XCircle className="h-3 w-3" />
                            {expert.failCount ?? 0}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Best Result / Current Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Brain className="h-4 w-4" />
              Best Result
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs">
            {bestIteration ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Accuracy</span>
                  <Badge variant="secondary">
                    {Math.round((bestIteration.accuracy ?? 0) * 100)}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Expert</span>
                  <span className="font-mono">{bestIteration.expert ?? '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Iteration</span>
                  <span className="font-mono">{bestIteration.iteration}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Pass/Fail</span>
                  <span>
                    <span className="text-green-600">{bestIteration.passCount ?? 0}</span>
                    {' / '}
                    <span className="text-red-600">{bestIteration.failCount ?? 0}</span>
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-slate-500">
                Waiting for first iteration...
              </div>
            )}
            
            {state.result?.isPredictionCorrect !== undefined && state.status === 'completed' && (
              <div className={`mt-3 rounded p-2 text-center ${
                state.result.isPredictionCorrect ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {state.result.isPredictionCorrect ? '✅ SOLVED' : '❌ NOT SOLVED'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Live Code Preview */}
      {state.streamingCode && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Code2 className="h-4 w-4" />
              Generated Code
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-32">
              <pre className="text-xs font-mono bg-slate-900 text-slate-100 p-2 rounded overflow-x-auto">
                {state.streamingCode}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
      {/* Iteration Progress - Compact Timeline */}
      {iterationHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Iteration History
              </span>
              <Badge variant="outline" className="text-xs">
                {iterationHistory.length} attempts
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {iterationHistory.slice(-30).map((entry, idx) => {
                const accuracy = entry.accuracy ?? 0;
                const bgColor = accuracy >= 1 
                  ? 'bg-green-500' 
                  : accuracy >= 0.5 
                    ? 'bg-amber-500' 
                    : 'bg-red-500';
                return (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded text-[8px] flex items-center justify-center text-white ${bgColor}`}
                    title={`Iter ${entry.iteration} | Expert ${entry.expert ?? '?'} | ${Math.round(accuracy * 100)}%`}
                  >
                    {entry.iteration}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live Log Stream */}
      {state.logLines && state.logLines.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4" />
              Live Events ({state.logLines.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-24">
              <div className="space-y-0.5 text-xs font-mono">
                {state.logLines.slice(-20).map((line, idx) => (
                  <div key={idx} className="text-slate-600 truncate">
                    {line}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default PoetiqLiveDashboard;
