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

import React from 'react';
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

  return (
    <Card className={`text-xs ${className}`}>
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-sm flex items-center gap-1.5">
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
        <div className="space-y-1.5 max-h-48 overflow-y-auto text-[10px]">
          {entries.length === 0 ? (
            <p className="text-muted-foreground text-center py-3">No actions yet</p>
          ) : (
            entries.map((entry, idx) => (
              <div
                key={idx}
                className={`p-1.5 rounded border ${
                  idx === entries.length - 1 && hasActiveToolCall
                    ? 'bg-blue-50 border-blue-300 animate-pulse'
                    : 'bg-muted/30'
                }`}
              >
                <p className="font-medium text-[10px]">{entry.label}</p>
                <pre className="text-[9px] text-muted-foreground mt-0.5 overflow-x-auto">
                  {entry.content.substring(0, 80)}...
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
