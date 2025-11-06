/*
Author: Claude (Windsurf Cascade)
Date: 2025-11-06
PURPOSE: Timeline component for displaying ARC3 agent messages and events in chronological order.
SRP/DRY check: Pass — isolates timeline display logic from message content and streaming state.
*/

import React, { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageSquare, Bot, Tool, Brain, ChevronDown, ChevronUp, ClearAll } from 'lucide-react';
import { Arc3MessageBubble } from './Arc3MessageBubble';

interface TimelineEntry {
  index: number;
  type: 'assistant_message' | 'tool_call' | 'tool_result' | 'reasoning';
  label: string;
  content: string;
  timestamp?: number;
}

interface Arc3ChatTimelineProps {
  timeline: TimelineEntry[];
  isStreaming?: boolean;
  streamingMessage?: string;
  error?: string;
  onClear?: () => void;
  className?: string;
}

export const Arc3ChatTimeline: React.FC<Arc3ChatTimelineProps> = ({
  timeline,
  isStreaming = false,
  streamingMessage,
  error,
  onClear,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [autoScroll, setAutoScroll] = React.useState(true);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && timelineRef.current) {
      const scrollElement = timelineRef.current;
      scrollElement.scrollTop = scrollElement.scrollHeight;
    }
  }, [timeline, autoScroll]);

  const handleScroll = () => {
    if (timelineRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = timelineRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
      setAutoScroll(isAtBottom);
    }
  };

  const getEntryCount = () => {
    const counts = {
      messages: 0,
      toolCalls: 0,
      toolResults: 0,
      reasoning: 0,
    };

    timeline.forEach(entry => {
      switch (entry.type) {
        case 'assistant_message':
          counts.messages++;
          break;
        case 'tool_call':
          counts.toolCalls++;
          break;
        case 'tool_result':
          counts.toolResults++;
          break;
        case 'reasoning':
          counts.reasoning++;
          break;
      }
    });

    return counts;
  };

  const counts = getEntryCount();

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5" />
            Agent Timeline
            {isStreaming && (
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            )}
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {/* Entry counts */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {counts.messages > 0 && (
                <Badge variant="outline" className="text-xs">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  {counts.messages}
                </Badge>
              )}
              {counts.toolCalls > 0 && (
                <Badge variant="outline" className="text-xs">
                  <Tool className="h-3 w-3 mr-1" />
                  {counts.toolCalls}
                </Badge>
              )}
              {counts.reasoning > 0 && (
                <Badge variant="outline" className="text-xs">
                  <Brain className="h-3 w-3 mr-1" />
                  {counts.reasoning}
                </Badge>
              )}
            </div>

            {/* Clear button */}
            {onClear && timeline.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClear}
                className="h-8 px-2"
              >
                <ClearAll className="h-3 w-3" />
              </Button>
            )}

            {/* Expand/Collapse button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 px-2"
            >
              {isExpanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>

        {/* Status indicator */}
        {isStreaming && streamingMessage && (
          <div className="text-sm text-blue-600 bg-blue-50 dark:bg-blue-950 p-2 rounded border">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              {streamingMessage}
            </div>
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950 p-2 rounded border">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Error: {error}
            </div>
          </div>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          {/* Timeline content */}
          <div
            ref={timelineRef}
            className="space-y-3 max-h-96 overflow-y-auto pr-2"
            onScroll={handleScroll}
          >
            {timeline.length === 0 && !isStreaming ? (
              <div className="text-center text-muted-foreground py-8">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No messages yet</p>
                <p className="text-sm">Start the agent to see the timeline</p>
              </div>
            ) : (
              <>
                {timeline.map((entry) => (
                  <Arc3MessageBubble
                    key={entry.index}
                    entry={entry}
                    timestamp={entry.timestamp}
                  />
                ))}

                {/* Streaming indicator */}
                {isStreaming && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 border-l-4 border-blue-200 bg-blue-50 dark:bg-blue-950">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span>Agent is thinking...</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Auto-scroll indicator */}
          {!autoScroll && timeline.length > 0 && (
            <div className="mt-2 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAutoScroll(true);
                  if (timelineRef.current) {
                    timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
                  }
                }}
              >
                Scroll to latest
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default Arc3ChatTimeline;
