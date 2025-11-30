/**
 * Author: Cascade
 * Date: 2025-11-30
 * PURPOSE: Compact OpenAI Agents runtime panel for Poetiq solver.
 *          Mirrors ARC3 playground agent UX by surfacing live reasoning,
 *          tool calls, and agent messages alongside existing Poetiq
 *          progress components.
 * SRP/DRY check: Pass - dedicated to Agents-specific telemetry display.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import type { PoetiqProgressState } from '@/hooks/usePoetiqProgress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, Brain, Code2, Server, Zap } from 'lucide-react';

interface PoetiqAgentsRuntimePanelProps {
  state: PoetiqProgressState;
}

export default function PoetiqAgentsRuntimePanel({ state }: PoetiqAgentsRuntimePanelProps) {
  const isAgentsRuntime =
    state.currentPromptData?.apiStyle === 'openai_agents' || !!state.agentModel;

  if (!isAgentsRuntime) {
    return null;
  }

  const reasoningRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (reasoningRef.current) {
      reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight;
    }
  }, [state.agentStreamingReasoning, state.agentTimeline?.length]);

  const agentModel = state.agentModel || state.currentPromptData?.model || 'OpenAI model';
  const agentRunIdShort = state.agentRunId ? `${state.agentRunId.slice(0, 8)}…` : 'N/A';
  const streamingReasoning =
    state.agentStreamingReasoning || state.streamingReasoning || '';

  const timeline = state.agentTimeline ?? [];
  const toolEntries = useMemo(
    () => timeline.filter((item) => item.type === 'tool_call' || item.type === 'tool_result'),
    [timeline],
  );
  const messageEntries = useMemo(
    () => timeline.filter((item) => item.type === 'output'),
    [timeline],
  );

  const usage = state.agentUsage;

  const statusLabel =
    state.status === 'running'
      ? 'RUNNING (Agents)'
      : state.status === 'completed'
        ? 'DONE (Agents)'
        : state.status === 'error'
          ? 'ERROR'
          : 'READY';

  const statusVariant: 'default' | 'secondary' | 'destructive' | 'outline' =
    state.status === 'running'
      ? 'default'
      : state.status === 'completed'
        ? 'secondary'
        : state.status === 'error'
          ? 'destructive'
          : 'outline';

  return (
    <div className="space-y-3">
      <Card className="border border-indigo-200">
        <CardHeader className="pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-indigo-600" />
            <CardTitle className="text-sm">Poetiq Agents runtime</CardTitle>
          </div>
          <Badge variant={statusVariant} className="text-[10px]">
            {statusLabel}
          </Badge>
        </CardHeader>
        <CardContent className="text-xs text-slate-700 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5 text-slate-500" />
              <span className="font-mono">{agentModel}</span>
            </div>
            <span className="text-[10px] text-slate-500">run: {agentRunIdShort}</span>
          </div>
          {usage && (
            <div className="text-[10px] text-slate-600">
              Tokens: {usage.inputTokens ?? 0} in / {usage.outputTokens ?? 0} out /{' '}
              {usage.totalTokens ?? 0} total
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-blue-200">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-blue-900">
            <Activity className="h-4 w-4 text-blue-600" />
            Live reasoning
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-1">
          <div
            ref={reasoningRef}
            className="max-h-40 overflow-y-auto rounded border border-blue-100 bg-blue-50/60 p-2 text-[11px] font-mono text-slate-800"
          >
            {streamingReasoning ? (
              <pre className="whitespace-pre-wrap">{streamingReasoning}</pre>
            ) : (
              <span className="text-slate-500">Waiting for agent reasoning…</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-emerald-200">
        <CardHeader className="pb-2 flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm text-emerald-900">
            <Zap className="h-4 w-4 text-emerald-600" />
            Sandbox evaluations
          </CardTitle>
          <Badge variant="outline" className="text-[10px]">
            {toolEntries.length} calls
          </Badge>
        </CardHeader>
        <CardContent className="pt-1">
          {toolEntries.length === 0 ? (
            <p className="text-[11px] text-emerald-700">
              No tool calls yet. The agent will call <code>submit_python_candidate</code> to
              evaluate candidate <code>transform()</code> code.
            </p>
          ) : (
            <ScrollArea className="h-40">
              <div className="space-y-1.5">
                {toolEntries.map((entry, idx) => {
                  const label = entry.label || entry.message || entry.toolName || 'Tool call';
                  const payload = entry.payload as any;
                  const rawOutput = payload?.output ?? payload?.arguments;
                  const outputStr =
                    typeof rawOutput === 'string'
                      ? rawOutput
                      : JSON.stringify(rawOutput, null, 2);
                  const clipped =
                    outputStr.length > 140 ? `${outputStr.slice(0, 140)}…` : outputStr;

                  return (
                    <div
                      key={entry.id ?? `tool-${idx}`}
                      className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px] font-medium text-emerald-900">
                        <span>{label}</span>
                        {entry.status && (
                          <span className="text-[10px] uppercase text-emerald-700">
                            {entry.status}
                          </span>
                        )}
                      </div>
                      <pre className="mt-0.5 whitespace-pre-wrap text-[10px] text-emerald-800">
                        {clipped}
                      </pre>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {messageEntries.length > 0 && (
        <Card className="border border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-900">
              <Code2 className="h-4 w-4 text-slate-700" />
              Agent messages
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            <ScrollArea className="h-32">
              <div className="space-y-1.5 text-[11px] text-slate-800">
                {messageEntries.map((entry, idx) => (
                  <div
                    key={entry.id ?? `msg-${idx}`}
                    className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5"
                  >
                    <pre className="whitespace-pre-wrap">
                      {entry.message || entry.label || 'Message'}
                    </pre>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
