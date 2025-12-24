import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { TinyGrid } from './TinyGrid';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, Brain } from 'lucide-react';
import type { ARCTask } from '@shared/types';

interface ChallengePuzzleCardProps {
  puzzleId: string;
}

export function ChallengePuzzleCard({ puzzleId }: ChallengePuzzleCardProps) {
  const [task, setTask] = useState<ARCTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/puzzle/task/${puzzleId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setTask(data.data);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [puzzleId]);

  if (error) return null; // Skip rendering if we can't load it

  return (
    <Link href={`/task/${puzzleId}`}>
      <a className="block group">
        <div className="relative overflow-hidden rounded-xl border-2 border-slate-700 bg-slate-800/50 transition-all duration-300 hover:-translate-y-1 hover:border-yellow-500/50 hover:shadow-xl hover:shadow-yellow-500/10">
          
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-slate-700/50 bg-slate-900/30">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-yellow-500" />
              <span className="font-mono font-bold text-slate-300 text-sm group-hover:text-yellow-400 transition-colors">
                {puzzleId}
              </span>
            </div>
            <ExternalLink className="h-3 w-3 text-slate-500 group-hover:text-slate-300" />
          </div>

          {/* Content */}
          <div className="p-4 flex justify-center items-center min-h-[160px]">
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
            ) : task?.train?.[0] ? (
              <div className="flex items-center gap-3 transform group-hover:scale-105 transition-transform duration-300">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Input</span>
                  <div className="w-24 h-24 flex items-center justify-center bg-white rounded shadow-sm p-1">
                    <TinyGrid grid={task.train[0].input} />
                  </div>
                </div>
                <div className="text-slate-600">→</div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Output</span>
                  <div className="w-24 h-24 flex items-center justify-center bg-white rounded shadow-sm p-1">
                    <TinyGrid grid={task.train[0].output} />
                  </div>
                </div>
              </div>
            ) : (
              <span className="text-slate-500 text-sm">Preview unavailable</span>
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 bg-yellow-500/10 border-t border-yellow-500/20 flex justify-center">
            <span className="text-xs font-bold text-yellow-500 uppercase tracking-wide">
              Founder's Challenge
            </span>
          </div>
        </div>
      </a>
    </Link>
  );
}
