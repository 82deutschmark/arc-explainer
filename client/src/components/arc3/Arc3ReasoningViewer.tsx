/*
 * Author: Cascade (Windsurf)
 * Date: 2025-12-07
 * PURPOSE: Reasoning viewer card for the ARC3 agent playground, extracted
 *          faithfully from ARC3AgentPlayground.tsx. Shows both reasoning
 *          and assistant messages plus live streaming deltas with
 *          auto-scroll behavior preserved.
 * SRP/DRY check: Pass — isolates reasoning display and scrolling logic
 *                from page layout and streaming orchestration.
 */

import React, { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain } from 'lucide-react';

interface TimelineEntry {
  index: number;
  type: 'assistant_message' | 'tool_call' | 'tool_result' | 'reasoning';
  label: string;
  content: string;
}

interface Arc3ReasoningViewerProps {
  timeline: TimelineEntry[];
  isPlaying: boolean;
  streamingMessage?: string;
  streamingReasoning?: string;
  className?: string;
}

export const Arc3ReasoningViewer: React.FC<Arc3ReasoningViewerProps> = ({
  timeline,
  isPlaying,
  streamingMessage,
  streamingReasoning,
  className = '',
}) => {
  const reasoningContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom when new content arrives (matches original page behavior)
  useEffect(() => {
    if (reasoningContainerRef.current) {
      const container = reasoningContainerRef.current;
      // Use timeout to wait for DOM update, as in the original implementation
      setTimeout(() => {
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      }, 0);
    }
  }, [timeline, streamingReasoning]);

  const reasoningEntries = timeline.filter((entry) => entry.type === 'reasoning');
  const assistantMessages = timeline.filter((entry) => entry.type === 'assistant_message');
  const combinedEntries = timeline.filter(
    (entry) => entry.type === 'reasoning' || entry.type === 'assistant_message',
  );

  return (
    <Card className={`h-full ${className}`}>
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-base font-bold flex items-center gap-1.5">
          <Brain className="h-4 w-4" />
          Agent Reasoning
          {isPlaying && <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div
          ref={reasoningContainerRef}
          className="space-y-2 max-h-[calc(100vh-10rem)] overflow-y-auto text-sm"
        >
          {reasoningEntries.length === 0 && assistantMessages.length === 0 && !isPlaying ? (
            <div className="text-center text-muted-foreground py-10">
              <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">No reasoning yet</p>
              <p className="text-[10px]">Start agent to see reasoning</p>
            </div>
          ) : (
            <>
              {/* Display all entries in chronological order */}
              {combinedEntries.map((entry, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border-l-4 ${
                    entry.type === 'reasoning'
                      ? 'bg-blue-50 dark:bg-blue-950 border-l-blue-500 border-r border-t border-b border-blue-200'
                      : 'bg-green-50 dark:bg-green-950 border-l-green-500 border-r border-t border-b border-green-200'
                  }`}
                >
                  <p
                    className={`font-bold text-base mb-1 ${
                      entry.type === 'reasoning' ? 'text-blue-700' : 'text-green-700'
                    }`}
                  >
                    {entry.label}
                  </p>
                  <pre className="text-base text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                    {entry.content}
                  </pre>
                </div>
              ))}

              {isPlaying && (
                <div className="p-3 rounded-lg border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-950 border-r border-t border-b border-blue-200 animate-pulse">
                  <div className="flex items-center gap-2 text-blue-700 mb-2 font-bold text-sm">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span>{streamingMessage || 'Agent thinking...'}</span>
                  </div>
                  {streamingReasoning && (
                    <pre className="text-base text-foreground whitespace-pre-wrap font-mono mt-2 leading-relaxed">
                      {streamingReasoning}
                    </pre>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default Arc3ReasoningViewer;
