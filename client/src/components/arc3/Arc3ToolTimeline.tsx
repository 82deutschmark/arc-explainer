/*
 * Author: Cascade (Windsurf)
 * Date: 2025-12-07
 * PURPOSE: Reusable timeline card for ARC3 tool calls/results, extracted faithfully
 *          from ARC3AgentPlayground to show recent ARC3 API actions.
 *          Displays tool_call/tool_result entries with a loading indicator
 *          while the agent is calling tools.
 * * SRP/DRY check: Pass — isolates tool timeline display from page layout and
 *                  streaming hook orchestration.
 */

import React, { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Wrench } from 'lucide-react';

export interface Arc3ToolTimelineEntry {
  label: string;
  content: string;
}

interface Arc3ToolTimelineProps {
  entries: Arc3ToolTimelineEntry[];
  isPlaying: boolean;
  streamingMessage?: string;
  className?: string;
}

export const Arc3ToolTimeline: React.FC<Arc3ToolTimelineProps> = ({
  entries,
  isPlaying,
  streamingMessage,
  className = '',
}) => {
  const hasActiveToolCall =
    isPlaying && (streamingMessage?.includes('called') ?? false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to the bottom whenever new tool entries arrive so the latest
  // ACTION / RESET calls and results stay visible during streaming.
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Defer to the next paint so layout has settled before scrolling.
    setTimeout(() => {
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 0);
  }, [entries]);

  return (
    <Card className={`text-sm h-full ${className}`}>
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-base flex items-center gap-1.5">
          <Wrench className="h-3.5 w-3.5" />
          Actions
          {hasActiveToolCall && (
            <div className="flex items-center gap-1">
              <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
              <span className="text-[9px] text-blue-600">Calling ARC3 API...</span>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div
          ref={containerRef}
          className="space-y-2 max-h-[calc(100vh-18rem)] overflow-y-auto text-sm"
        >
          {entries.length === 0 ? (
            <p className="text-muted-foreground text-center py-3">No actions yet</p>
          ) : (
            entries.map((entry, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-md border shadow-sm ${
                  entry.label.toLowerCase().startsWith('result from')
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-500/60'
                    : 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-500/60'
                } ${idx === entries.length - 1 && hasActiveToolCall ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
              >
                <p className="font-semibold text-xs text-slate-900 dark:text-slate-50 tracking-tight mb-1">
                  {entry.label}
                </p>
                <pre className="text-[13px] leading-relaxed text-slate-900 dark:text-slate-50 overflow-x-auto whitespace-pre-wrap font-mono bg-white/90 dark:bg-slate-900/70 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 shadow-inner">
                  {entry.content}
                </pre>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default Arc3ToolTimeline;
