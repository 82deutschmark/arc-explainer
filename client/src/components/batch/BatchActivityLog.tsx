/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-07
 * PURPOSE: Elegant activity log component showing real-time batch analysis events.
 *          Terminal-style display with color-coded messages and auto-scroll.
 *
 * SRP and DRY check: Pass - Single responsibility: activity log display
 * shadcn/ui: Pass - Uses shadcn/ui Card component
 */

import React, { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ActivityLogEntry {
  timestamp: Date | string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  puzzleId?: string;
}

interface BatchActivityLogProps {
  activityLog: ActivityLogEntry[];
  currentPuzzle?: string;
  className?: string;
}

export function BatchActivityLog({ activityLog, currentPuzzle, className }: BatchActivityLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activityLog]);

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'warning':
        return 'text-amber-600';
      default:
        return 'text-blue-600';
    }
  };

  const formatTimestamp = (timestamp: Date | string) => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (!activityLog || activityLog.length === 0) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="text-center text-gray-500">
          No activity yet. Start a batch analysis to see live updates.
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('bg-gray-950 border-gray-800', className)}>
      <ScrollArea className="h-[400px]" ref={scrollRef}>
        <div className="p-4 font-mono text-sm space-y-1">
          {activityLog.map((entry, index) => (
            <div
              key={index}
              className={cn(
                'flex gap-3 hover:bg-gray-900/50 px-2 py-1 rounded transition-colors',
                getTypeStyles(entry.type)
              )}
            >
              <span className="text-gray-500 shrink-0">
                [{formatTimestamp(entry.timestamp)}]
              </span>
              <span className="break-all">{entry.message}</span>
            </div>
          ))}

          {/* Current puzzle indicator */}
          {currentPuzzle && (
            <div className="flex gap-3 animate-pulse bg-blue-900/20 px-2 py-1 rounded">
              <span className="text-gray-500 shrink-0">
                [{formatTimestamp(new Date())}]
              </span>
              <span className="text-blue-400">
                ⚡ Processing: {currentPuzzle}
              </span>
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
