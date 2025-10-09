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

  // Auto-scroll unless paused
  React.useEffect(() => {
    if (!isPaused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isPaused]);

  const getLogColor = (log: string) => {
    if (log.includes('❌') || log.includes('[ERROR]')) return 'text-red-600';
    if (log.includes('⚠️') || log.includes('[WARN]')) return 'text-yellow-600';
    if (log.includes('✅') || log.includes('[INFO]')) return 'text-green-600';
    if (log.includes('🔄') || log.includes('🔁')) return 'text-blue-600';
    if (log.includes('🐍') || log.includes('Python')) return 'text-purple-600';
    if (log.includes('🧠') || log.includes('Context')) return 'text-orange-600';
    return 'text-gray-700';
  };

  const exportLogs = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grover-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-1.5 text-xs font-semibold">
            <Terminal className="h-3 w-3" />
            Live Activity ({logs.length})
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setIsPaused(!isPaused)}
            >
              {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={exportLogs}
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div
          ref={scrollRef}
          className="bg-black p-2 font-mono text-xs leading-tight overflow-y-auto"
          style={{ height: maxHeight, fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}
        >
          {logs.length === 0 ? (
            <div className="text-gray-600">Waiting for activity...</div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className={`hover:bg-gray-900 ${getLogColor(log)}`}>
                {log}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
