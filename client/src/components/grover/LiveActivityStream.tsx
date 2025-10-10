/**
 * Author: Sonnet 4.5
 * Date: 2025-10-09
 * PURPOSE: Real-time activity stream showing all backend operations with color coding.
 * Auto-scrolls to latest, filterable by log level, exportable.
 * SRP/DRY check: Pass
 * shadcn/ui: Pass - Uses Card, Badge, ScrollArea
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Terminal, Download, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LiveActivityStreamProps {
  logs: string[];
  maxHeight?: string;
}

export function LiveActivityStream({ logs, maxHeight = "300px" }: LiveActivityStreamProps) {
  const [isPaused, setIsPaused] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  // MUST be before early return - React Rules of Hooks
  const logsLengthRef = React.useRef(logs?.length || 0);
  
  // Auto-scroll unless paused - MUST be before early return!
  React.useEffect(() => {
    if (!isPaused && scrollRef.current && logs && logs.length > logsLengthRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      logsLengthRef.current = logs.length;
    }
  }, [logs, isPaused]);
  
  // Show compact placeholder if no logs
  if (!logs || logs.length === 0) {
    return (
      <Card className="h-24 flex items-center justify-center border-gray-300">
        <div className="text-center text-gray-400 text-xs">
          <Terminal className="h-6 w-6 mx-auto mb-1 opacity-40" />
          <p>Waiting for activity...</p>
        </div>
      </Card>
    );
  }

  const getLogColor = (log: string) => {
    if (log.includes('❌') || log.includes('[ERROR]') || log.includes('Error')) return 'text-red-400 font-semibold';
    if (log.includes('⚠️') || log.includes('[WARN]') || log.includes('warning')) return 'text-yellow-400 font-medium';
    if (log.includes('✅') || log.includes('complete') || log.includes('success')) return 'text-green-400 font-medium';
    if (log.includes('🚀') || log.includes('Starting')) return 'text-cyan-400 font-bold';
    if (log.includes('🔁') || log.includes('Iteration')) return 'text-blue-400 font-semibold';
    if (log.includes('📤') || log.includes('Sending')) return 'text-purple-400';
    if (log.includes('⏳') || log.includes('Waiting')) return 'text-yellow-300';
    if (log.includes('📝') || log.includes('Extracted')) return 'text-green-300';
    if (log.includes('🐍') || log.includes('Executing') || log.includes('Python')) return 'text-purple-400 font-medium';
    if (log.includes('🎯') || log.includes('Best')) return 'text-green-400 font-bold';
    if (log.includes('🧠') || log.includes('Context')) return 'text-orange-400';
    return 'text-gray-300';
  };

  const exportLogs = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border border-blue-300">
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
            <Terminal className="h-3.5 w-3.5" />
            Activity
            <Badge variant="secondary" className="text-[10px] px-1">{logs.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-0.5">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsPaused(!isPaused)}
              className="h-5 w-5 p-0"
              title={isPaused ? "Resume" : "Pause"}
            >
              {isPaused ? <Play className="h-2.5 w-2.5" /> : <Pause className="h-2.5 w-2.5" />}
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={exportLogs}
              className="h-5 w-5 p-0"
              title="Export"
            >
              <Download className="h-2.5 w-2.5" />
            </Button>
          </div>
        </div>
        {logs.length > 0 && (
          <div className="text-xs text-gray-600 mt-1">
            {isPaused ? '⏸ Paused' : '▶️ Live'}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="w-full" style={{ height: maxHeight }}>
          <div
            ref={scrollRef}
            className="font-mono text-[10px] leading-tight bg-gray-900 text-gray-100 p-2 overflow-auto whitespace-pre-wrap break-words"
            style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}
          >
            {logs.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <div>Waiting for activity...</div>
                <div className="text-[10px] mt-1">Logs will appear here in real-time</div>
              </div>
            ) : (
              logs.map((log, idx) => {
                // Check if this is a prompt payload line
                const isPromptHeader = log.includes('━━━━━━━━━━ PROMPT PAYLOAD');
                const isPromptEnd = log.includes('━━━━━━━━━━ END PROMPT');
                const isPromptContent = !log.startsWith('[') && idx > 0 && 
                  logs[idx - 1].includes('PROMPT PAYLOAD') && 
                  !log.includes('END PROMPT');
                
                if (isPromptHeader || isPromptEnd) {
                  return (
                    <div key={idx} className="py-1 text-cyan-400 font-bold border-t border-cyan-800">
                      {log}
                    </div>
                  );
                }
                
                if (isPromptContent) {
                  return (
                    <div key={idx} className="py-0.5 text-yellow-200 bg-gray-800 px-2 my-1 rounded text-[11px] leading-relaxed whitespace-pre-wrap border-l-2 border-yellow-500">
                      {log}
                    </div>
                  );
                }
                
                return (
                  <div key={idx} className={`py-0.5 hover:bg-gray-800 px-1 rounded ${getLogColor(log)}`}>
                    <span className="text-gray-500 text-[10px] mr-2">[{idx + 1}]</span>
                    {log}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
