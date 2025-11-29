/**
 * Author: Cascade using Claude Sonnet 4
 * Date: 2025-11-26
 * PURPOSE: Real-time activity stream for Poetiq solver - borrowed from Grover pattern.
 *          Shows backend operations with color coding, auto-scroll, and export.
 *
 * SRP/DRY check: Pass - Single responsibility for activity log display
 * shadcn/ui: Pass - Uses Card, Badge, ScrollArea patterns
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Terminal, Download, Pause, Play, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PoetiqLiveActivityStreamProps {
  logs: string[];
  maxHeight?: string;
  onClear?: () => void;
}

export function PoetiqLiveActivityStream({ 
  logs, 
  maxHeight = '300px',
  onClear,
}: PoetiqLiveActivityStreamProps) {
  const [isPaused, setIsPaused] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const logsLengthRef = React.useRef(logs?.length || 0);

  // Auto-scroll unless paused
  React.useEffect(() => {
    if (!isPaused && scrollRef.current && logs && logs.length > logsLengthRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      logsLengthRef.current = logs.length;
    }
  }, [logs, isPaused]);

  // Color coding for Poetiq-specific log patterns
  const getLogColor = (log: string) => {
    const lowerLog = log.toLowerCase();

    if (lowerLog.includes('error') || lowerLog.includes('failed') || lowerLog.includes('exception')) {
      return 'text-red-400 font-semibold';
    }
    if (lowerLog.includes('warn') || lowerLog.includes('caution')) {
      return 'text-yellow-400 font-medium';
    }
    if (lowerLog.includes('success') || lowerLog.includes('correct') || lowerLog.includes('pass')) {
      return 'text-green-400 font-medium';
    }
    if (lowerLog.includes('starting') || lowerLog.includes('initializing') || lowerLog.includes('boot')) {
      return 'text-cyan-400 font-bold';
    }
    if (lowerLog.includes('iteration') || lowerLog.includes('loop')) {
      return 'text-blue-400 font-semibold';
    }
    if (lowerLog.includes('generating') || lowerLog.includes('code') || lowerLog.includes('transform')) {
      return 'text-purple-400 font-medium';
    }
    if (lowerLog.includes('testing') || lowerLog.includes('executing') || lowerLog.includes('running')) {
      return 'text-orange-400';
    }
    if (lowerLog.includes('expert') || lowerLog.includes('voting')) {
      return 'text-pink-400';
    }
    if (lowerLog.includes('score') || lowerLog.includes('accuracy')) {
      return 'text-emerald-400';
    }

    return 'text-gray-300';
  };

  const exportLogs = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `poetiq-log-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Empty state
  if (!logs || logs.length === 0) {
    return (
      <Card className="h-24 flex items-center justify-center border-purple-300/30 bg-purple-50/5">
        <div className="text-center text-gray-400 text-xs">
          <Terminal className="h-6 w-6 mx-auto mb-1 opacity-40" />
          <p>Waiting for activity...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border border-purple-300/30 bg-gradient-to-br from-slate-900/50 to-purple-900/50">
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-semibold text-white/90 flex items-center gap-1.5">
            <Terminal className="h-3.5 w-3.5 text-purple-400" />
            Activity
            <Badge variant="secondary" className="text-[10px] px-1 bg-purple-500/30 text-purple-300">
              {logs.length}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsPaused(!isPaused)}
              className="h-6 w-6 p-0 text-white/60 hover:text-white hover:bg-white/10"
              title={isPaused ? 'Resume auto-scroll' : 'Pause auto-scroll'}
            >
              {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={exportLogs}
              className="h-6 w-6 p-0 text-white/60 hover:text-white hover:bg-white/10"
              title="Export logs"
            >
              <Download className="h-3 w-3" />
            </Button>
            {onClear && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClear}
                className="h-6 w-6 p-0 text-white/60 hover:text-red-400 hover:bg-white/10"
                title="Clear logs"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        <div className="text-xs text-white/50 mt-1">
          {isPaused ? 'Paused (auto-scroll off)' : 'Live (auto-scroll on)'}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="w-full" style={{ height: maxHeight }}>
          <div
            ref={scrollRef}
            className="font-mono text-[10px] leading-tight bg-black/40 text-gray-100 p-2 overflow-auto whitespace-pre-wrap break-words"
            style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}
          >
            {logs.map((log, idx) => {
              // Check for special formatting
              const isCodeBlock = log.startsWith('```') || log.startsWith('def ') || log.startsWith('    ');
              const isSeparator = /(-{3,}|=+|\*{3,})/.test(log.trim());
              
              if (isSeparator) {
                return (
                  <div key={idx} className="py-1 text-purple-400/60 border-y border-purple-400/20 my-1">
                    {log}
                  </div>
                );
              }
              
              if (isCodeBlock) {
                return (
                  <div key={idx} className="py-0.5 text-green-300 bg-green-900/20 px-2 my-0.5 rounded border-l-2 border-green-500">
                    {log}
                  </div>
                );
              }
              
              return (
                <div key={idx} className={`py-0.5 hover:bg-white/5 px-1 rounded ${getLogColor(log)}`}>
                  <span className="text-gray-600 text-[9px] mr-2 select-none">[{idx + 1}]</span>
                  {log}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default PoetiqLiveActivityStream;
